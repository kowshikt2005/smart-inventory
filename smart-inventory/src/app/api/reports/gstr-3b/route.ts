import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMonthDates, getMonthName, splitTax } from "@/lib/gst-report-utils";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get("month") || "");
    const year = parseInt(searchParams.get("year") || "");

    if (!month || !year) {
      return NextResponse.json(
        { error: "month and year are required" },
        { status: 400 }
      );
    }

    const { startDate, endDate } = getMonthDates(month, year);
    const dateFilter = { gte: startDate, lte: endDate };

    // === 3.1 Outward Supplies (Sales) ===
    const salesInvoices = await db.invoice.findMany({
      where: { invoiceDate: dateFilter, paymentStatus: { not: "CANCELLED" } },
      include: {
        items: { select: { taxRate: true, amount: true, taxAmount: true } },
      },
    });

    let totalSalesTaxable = 0;
    let totalSalesTax = 0;
    const rateWiseMap = new Map<
      number,
      { rate: number; taxableValue: number; cgst: number; sgst: number }
    >();

    for (const inv of salesInvoices) {
      totalSalesTaxable += Number(inv.subtotal);
      totalSalesTax += Number(inv.taxAmount);

      for (const it of inv.items) {
        const rate = Number(it.taxRate);
        const existing = rateWiseMap.get(rate) || {
          rate,
          taxableValue: 0,
          cgst: 0,
          sgst: 0,
        };
        const tax = splitTax(Number(it.taxAmount));
        existing.taxableValue += Number(it.amount);
        existing.cgst += tax.cgst;
        existing.sgst += tax.sgst;
        rateWiseMap.set(rate, existing);
      }
    }

    const salesTax = splitTax(totalSalesTax);
    const outwardSupplies = {
      taxableValue: totalSalesTaxable,
      cgst: salesTax.cgst,
      sgst: salesTax.sgst,
      rateWise: Array.from(rateWiseMap.values()).sort((a, b) => a.rate - b.rate),
    };

    // === 4. Input Tax Credit ===
    // ITC Available: from purchase invoices
    const purchaseInvoices = await db.purchaseInvoice.findMany({
      where: { date: dateFilter, status: { not: "CANCELLED" } },
      select: { amount: true, taxAmount: true },
    });

    let purchaseTaxable = 0;
    let purchaseTaxTotal = 0;
    for (const pi of purchaseInvoices) {
      purchaseTaxable += Number(pi.amount);
      purchaseTaxTotal += Number(pi.taxAmount);
    }
    const itcAvailableTax = splitTax(purchaseTaxTotal);

    // ITC Reversed: from purchase returns
    const purchaseReturns = await db.purchaseReturn.findMany({
      where: { date: dateFilter, status: "COMPLETED" },
      select: { amount: true, taxAmount: true },
    });

    let returnTaxable = 0;
    let returnTaxTotal = 0;
    for (const pr of purchaseReturns) {
      returnTaxable += Number(pr.amount);
      returnTaxTotal += Number(pr.taxAmount);
    }
    const itcReversedTax = splitTax(returnTaxTotal);

    const netITCcgst = itcAvailableTax.cgst - itcReversedTax.cgst;
    const netITCsgst = itcAvailableTax.sgst - itcReversedTax.sgst;

    const inputTaxCredit = {
      available: {
        taxableValue: purchaseTaxable,
        cgst: itcAvailableTax.cgst,
        sgst: itcAvailableTax.sgst,
      },
      reversed: {
        taxableValue: returnTaxable,
        cgst: itcReversedTax.cgst,
        sgst: itcReversedTax.sgst,
      },
      net: { cgst: netITCcgst, sgst: netITCsgst },
    };

    // === 5. Tax Payable ===
    const netCGST = salesTax.cgst - netITCcgst;
    const netSGST = salesTax.sgst - netITCsgst;

    const taxPayable = {
      output: { cgst: salesTax.cgst, sgst: salesTax.sgst },
      input: { cgst: netITCcgst, sgst: netITCsgst },
      net: { cgst: netCGST, sgst: netSGST, total: netCGST + netSGST },
    };

    return NextResponse.json({
      period: { month: getMonthName(month), year },
      outwardSupplies,
      inputTaxCredit,
      taxPayable,
    });
  } catch (error) {
    console.error("Error fetching GSTR-3B:", error);
    return NextResponse.json(
      { error: "Failed to fetch GSTR-3B report" },
      { status: 500 }
    );
  }
}
