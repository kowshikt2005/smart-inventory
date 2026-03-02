import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getMonthDates,
  getMonthName,
  getPlaceOfSupply,
  splitTax,
} from "@/lib/gst-report-utils";
import { checkPermission } from "@/lib/api-auth";

export async function GET(request: Request) {
  try {
    const { error } = await checkPermission('reports', 'view');
    if (error) return error;

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

    // Fetch purchase invoices
    const purchaseInvoices = await db.purchaseInvoice.findMany({
      where: { date: dateFilter, status: { not: "CANCELLED" } },
      include: {
        vendor: { select: { gstin: true, name: true, state: true } },
        items: {
          include: {
            item: {
              select: { hsnCode: true, gstRate: true, unit: true, name: true },
            },
          },
        },
      },
      orderBy: { date: "asc" },
    });

    // Invoice details
    const invoices = purchaseInvoices.map((pi) => {
      const { cgst, sgst } = splitTax(Number(pi.taxAmount));
      return {
        vendorGstin: pi.vendor.gstin || "-",
        vendorName: pi.vendor.name,
        invoiceNumber: pi.invoiceNumber,
        date: pi.date,
        placeOfSupply: getPlaceOfSupply(pi.vendor.gstin, pi.vendor.state),
        taxableValue: Number(pi.amount),
        cgst,
        sgst,
        total: Number(pi.totalAmount),
        items: pi.items.map((it) => ({
          name: it.item.name,
          hsnCode: it.item.hsnCode,
          qty: Number(it.quantity),
          rate: Number(it.rate),
          taxableValue: Number(it.amount),
          taxRate: Number(it.taxRate),
          ...splitTax(Number(it.taxAmount)),
        })),
      };
    });

    // HSN Summary
    const hsnMap = new Map<
      string,
      {
        hsnCode: string;
        description: string;
        uqc: string;
        qty: number;
        taxableValue: number;
        cgst: number;
        sgst: number;
        rate: number;
      }
    >();
    for (const pi of purchaseInvoices) {
      for (const it of pi.items) {
        const hsnCode = it.item.hsnCode || "N/A";
        const rate = Number(it.taxRate);
        const key = `${hsnCode}|${rate}`;
        const existing = hsnMap.get(key) || {
          hsnCode,
          description: it.item.name,
          uqc: it.item.unit,
          qty: 0,
          taxableValue: 0,
          cgst: 0,
          sgst: 0,
          rate,
        };
        const tax = splitTax(Number(it.taxAmount));
        existing.qty += Number(it.quantity);
        existing.taxableValue += Number(it.amount);
        existing.cgst += tax.cgst;
        existing.sgst += tax.sgst;
        hsnMap.set(key, existing);
      }
    }
    const hsn = Array.from(hsnMap.values());

    // Summary
    const totalTaxableValue = invoices.reduce(
      (s, i) => s + i.taxableValue,
      0
    );
    const totalCGST = invoices.reduce((s, i) => s + i.cgst, 0);
    const totalSGST = invoices.reduce((s, i) => s + i.sgst, 0);
    const totalValue = invoices.reduce((s, i) => s + i.total, 0);

    return NextResponse.json({
      period: { month: getMonthName(month), year },
      invoices,
      hsn,
      summary: {
        totalInvoices: invoices.length,
        totalTaxableValue,
        totalCGST,
        totalSGST,
        totalValue,
      },
    });
  } catch (error) {
    console.error("Error fetching GSTR-2:", error);
    return NextResponse.json(
      { error: "Failed to fetch GSTR-2 report" },
      { status: 500 }
    );
  }
}
