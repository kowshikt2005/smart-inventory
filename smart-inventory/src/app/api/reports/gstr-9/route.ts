import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getFYDates, splitTax } from "@/lib/gst-report-utils";
import { checkPermission } from "@/lib/api-auth";

const MONTH_NAMES = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March",
];

export async function GET(request: Request) {
  try {
    const { error } = await checkPermission('reports', 'view');
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const fy = searchParams.get("fy");

    if (!fy) {
      return NextResponse.json(
        { error: "fy is required (e.g. 2025-26)" },
        { status: 400 }
      );
    }

    const { startDate, endDate } = getFYDates(fy);
    const dateFilter = { gte: startDate, lte: endDate };

    // === Part II — Outward Supplies ===
    const salesInvoices = await db.invoice.findMany({
      where: { invoiceDate: dateFilter, paymentStatus: { not: "CANCELLED" } },
      include: { customer: { select: { gstin: true } } },
    });

    let salesCount = 0,
      salesValue = 0,
      salesTaxable = 0,
      salesTax = 0;
    let b2bCount = 0,
      b2bValue = 0,
      b2cCount = 0,
      b2cValue = 0;

    for (const inv of salesInvoices) {
      salesCount++;
      salesValue += Number(inv.totalAmount);
      salesTaxable += Number(inv.subtotal);
      salesTax += Number(inv.taxAmount);
      if (inv.customer?.gstin) {
        b2bCount++;
        b2bValue += Number(inv.totalAmount);
      } else {
        b2cCount++;
        b2cValue += Number(inv.totalAmount);
      }
    }

    const salesTaxSplit = splitTax(salesTax);

    // Credit notes (sales returns)
    const salesReturns = await db.salesReturn.findMany({
      where: { returnDate: dateFilter, status: "COMPLETED" },
    });

    let cnCount = 0, cnValue = 0, cnTax = 0;
    for (const sr of salesReturns) {
      cnCount++;
      cnValue += Number(sr.totalAmount);
      cnTax += Number(sr.taxAmount);
    }

    const netOutwardValue = salesValue - cnValue;
    const netOutwardTax = salesTax - cnTax;

    const partII = {
      totalSales: {
        count: salesCount,
        value: salesValue,
        taxableValue: salesTaxable,
        cgst: salesTaxSplit.cgst,
        sgst: salesTaxSplit.sgst,
      },
      b2b: { count: b2bCount, value: b2bValue },
      b2c: { count: b2cCount, value: b2cValue },
      creditNotes: { count: cnCount, value: cnValue, tax: cnTax },
      netOutward: { value: netOutwardValue, tax: netOutwardTax },
    };

    // === Part III — ITC Details ===
    const purchaseInvoices = await db.purchaseInvoice.findMany({
      where: { date: dateFilter, status: { not: "CANCELLED" } },
    });

    let purchaseCount = 0,
      purchaseValue = 0,
      purchaseTaxable = 0,
      purchaseTax = 0;
    for (const pi of purchaseInvoices) {
      purchaseCount++;
      purchaseValue += Number(pi.totalAmount);
      purchaseTaxable += Number(pi.amount);
      purchaseTax += Number(pi.taxAmount);
    }
    const purchaseTaxSplit = splitTax(purchaseTax);

    // Debit notes (purchase returns)
    const purchaseReturns = await db.purchaseReturn.findMany({
      where: { date: dateFilter, status: "COMPLETED" },
    });

    let dnCount = 0, dnValue = 0, dnTax = 0;
    for (const pr of purchaseReturns) {
      dnCount++;
      dnValue += Number(pr.totalAmount);
      dnTax += Number(pr.taxAmount);
    }

    const netITC = splitTax(purchaseTax - dnTax);

    const partIII = {
      totalPurchases: {
        count: purchaseCount,
        value: purchaseValue,
        taxableValue: purchaseTaxable,
        cgst: purchaseTaxSplit.cgst,
        sgst: purchaseTaxSplit.sgst,
      },
      debitNotes: { count: dnCount, value: dnValue, tax: dnTax },
      netITC: { cgst: netITC.cgst, sgst: netITC.sgst },
    };

    // === Part IV — Tax Paid ===
    const outputTax = splitTax(netOutwardTax);
    const partIV = {
      output: { cgst: outputTax.cgst, sgst: outputTax.sgst },
      input: { cgst: netITC.cgst, sgst: netITC.sgst },
      net: {
        cgst: outputTax.cgst - netITC.cgst,
        sgst: outputTax.sgst - netITC.sgst,
        total: outputTax.cgst - netITC.cgst + outputTax.sgst - netITC.sgst,
      },
    };

    // === Monthly Breakdown ===
    const [startYear] = fy.split("-").map(Number);
    const monthly = [];

    for (let i = 0; i < 12; i++) {
      // April (month 3) of startYear through March (month 2) of startYear+1
      const monthIndex = (3 + i) % 12; // 0-indexed JS month
      const yr = monthIndex < 3 ? startYear + 1 : startYear;
      const monthStart = new Date(yr, monthIndex, 1);
      const monthEnd = new Date(yr, monthIndex + 1, 0, 23, 59, 59, 999);
      const mFilter = { gte: monthStart, lte: monthEnd };

      const [salesAgg, purchaseAgg] = await Promise.all([
        db.invoice.aggregate({
          where: {
            invoiceDate: mFilter,
            paymentStatus: { not: "CANCELLED" },
          },
          _sum: { totalAmount: true, taxAmount: true },
        }),
        db.purchaseInvoice.aggregate({
          where: { date: mFilter, status: { not: "CANCELLED" } },
          _sum: { totalAmount: true, taxAmount: true },
        }),
      ]);

      const salesVal = Number(salesAgg._sum.totalAmount || 0);
      const sTax = Number(salesAgg._sum.taxAmount || 0);
      const purchaseVal = Number(purchaseAgg._sum.totalAmount || 0);
      const pTax = Number(purchaseAgg._sum.taxAmount || 0);

      monthly.push({
        month: MONTH_NAMES[i],
        salesValue: salesVal,
        salesTax: sTax,
        purchaseValue: purchaseVal,
        purchaseTax: pTax,
        netTax: sTax - pTax,
      });
    }

    return NextResponse.json({
      financialYear: fy,
      partII,
      partIII,
      partIV,
      monthly,
    });
  } catch (error) {
    console.error("Error fetching GSTR-9:", error);
    return NextResponse.json(
      { error: "Failed to fetch GSTR-9 report" },
      { status: 500 }
    );
  }
}
