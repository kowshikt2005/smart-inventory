import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getMonthDates,
  getMonthName,
  getPlaceOfSupply,
  splitTax,
} from "@/lib/gst-report-utils";

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

    // Fetch all invoices in range (exclude CANCELLED)
    const invoices = await db.invoice.findMany({
      where: {
        invoiceDate: dateFilter,
        paymentStatus: { not: "CANCELLED" },
      },
      include: {
        customer: {
          select: { gstin: true, name: true, state: true },
        },
        items: {
          include: {
            item: {
              select: { hsnCode: true, gstRate: true, unit: true, name: true },
            },
          },
        },
      },
      orderBy: { invoiceDate: "asc" },
    });

    // === B2B: customer has GSTIN ===
    const b2bInvoices = invoices.filter((inv) => inv.customer.gstin);
    const b2b = b2bInvoices.map((inv) => {
      const { cgst, sgst } = splitTax(Number(inv.taxAmount));
      return {
        invoiceNumber: inv.invoiceNumber,
        date: inv.invoiceDate,
        customerGstin: inv.customer.gstin,
        customerName: inv.customer.name,
        placeOfSupply: getPlaceOfSupply(inv.customer.gstin, inv.customer.state),
        taxableValue: Number(inv.subtotal),
        cgst,
        sgst,
        total: Number(inv.totalAmount),
        items: inv.items.map((it) => ({
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

    // === B2C Large: no GSTIN, total > 2.5L ===
    const b2cLargeInvoices = invoices.filter(
      (inv) => !inv.customer.gstin && Number(inv.totalAmount) > 250000
    );
    const b2cLargeMap = new Map<
      string,
      { placeOfSupply: string; rate: number; taxableValue: number; cgst: number; sgst: number; count: number }
    >();
    for (const inv of b2cLargeInvoices) {
      const pos = getPlaceOfSupply(null, inv.customer.state);
      for (const it of inv.items) {
        const rate = Number(it.taxRate);
        const key = `${pos}|${rate}`;
        const existing = b2cLargeMap.get(key) || {
          placeOfSupply: pos,
          rate,
          taxableValue: 0,
          cgst: 0,
          sgst: 0,
          count: 0,
        };
        const tax = splitTax(Number(it.taxAmount));
        existing.taxableValue += Number(it.amount);
        existing.cgst += tax.cgst;
        existing.sgst += tax.sgst;
        b2cLargeMap.set(key, existing);
      }
      // Increment count once per invoice for the first key
      const pos0 = getPlaceOfSupply(null, inv.customer.state);
      const rate0 = inv.items.length > 0 ? Number(inv.items[0].taxRate) : 0;
      const key0 = `${pos0}|${rate0}`;
      const e = b2cLargeMap.get(key0);
      if (e) e.count += 1;
    }
    const b2cLarge = Array.from(b2cLargeMap.values());

    // === B2C Small: no GSTIN, total <= 2.5L ===
    const b2cSmallInvoices = invoices.filter(
      (inv) => !inv.customer.gstin && Number(inv.totalAmount) <= 250000
    );
    const b2cSmallMap = new Map<
      string,
      { rate: number; taxableValue: number; cgst: number; sgst: number }
    >();
    for (const inv of b2cSmallInvoices) {
      for (const it of inv.items) {
        const rate = Number(it.taxRate);
        const key = `${rate}`;
        const existing = b2cSmallMap.get(key) || {
          rate,
          taxableValue: 0,
          cgst: 0,
          sgst: 0,
        };
        const tax = splitTax(Number(it.taxAmount));
        existing.taxableValue += Number(it.amount);
        existing.cgst += tax.cgst;
        existing.sgst += tax.sgst;
        b2cSmallMap.set(key, existing);
      }
    }
    const b2cSmall = Array.from(b2cSmallMap.values());

    // === CDNR: Credit notes to registered dealers ===
    const salesReturns = await db.salesReturn.findMany({
      where: {
        returnDate: dateFilter,
        status: "COMPLETED",
        customer: { gstin: { not: null } },
      },
      include: {
        customer: { select: { gstin: true, name: true } },
        invoice: { select: { invoiceNumber: true } },
      },
      orderBy: { returnDate: "asc" },
    });
    const cdnr = salesReturns.map((sr) => {
      const { cgst, sgst } = splitTax(Number(sr.taxAmount));
      return {
        noteNumber: sr.returnNumber,
        noteDate: sr.returnDate,
        noteType: "C" as const,
        originalInvoice: sr.invoice?.invoiceNumber || "-",
        customerGstin: sr.customer.gstin,
        customerName: sr.customer.name,
        taxableValue: Number(sr.subtotal),
        cgst,
        sgst,
      };
    });

    // === HSN Summary ===
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
    for (const inv of invoices) {
      for (const it of inv.items) {
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

    // === Document Summary ===
    const allInvoiceNumbers = invoices.map((i) => i.invoiceNumber).sort();
    const cancelledCount = await db.invoice.count({
      where: { invoiceDate: dateFilter, paymentStatus: "CANCELLED" },
    });
    const documents = {
      from: allInvoiceNumbers[0] || "-",
      to: allInvoiceNumbers[allInvoiceNumbers.length - 1] || "-",
      total: invoices.length + cancelledCount,
      cancelled: cancelledCount,
      netIssued: invoices.length,
    };

    // === Summary ===
    const totalB2B = b2b.reduce((s, i) => s + i.taxableValue, 0);
    const totalB2CLarge = b2cLarge.reduce((s, i) => s + i.taxableValue, 0);
    const totalB2CSmall = b2cSmall.reduce((s, i) => s + i.taxableValue, 0);
    const totalCDNR = cdnr.reduce((s, i) => s + i.taxableValue, 0);
    const totalTaxableValue = totalB2B + totalB2CLarge + totalB2CSmall;
    const totalTax = invoices.reduce((s, i) => s + Number(i.taxAmount), 0);

    return NextResponse.json({
      period: { month: getMonthName(month), year },
      b2b,
      b2cLarge,
      b2cSmall,
      cdnr,
      hsn,
      documents,
      summary: {
        totalB2B,
        totalB2CLarge,
        totalB2CSmall,
        totalCDNR,
        totalTaxableValue,
        totalTax,
      },
    });
  } catch (error) {
    console.error("Error fetching GSTR-1:", error);
    return NextResponse.json(
      { error: "Failed to fetch GSTR-1 report" },
      { status: 500 }
    );
  }
}
