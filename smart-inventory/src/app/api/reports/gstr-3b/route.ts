import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getMonthDates,
  getMonthName,
  fmtFilingPeriod,
  splitGST,
  getStateCode,
  round2,
} from "@/lib/gst-report-utils";
import { checkPermission } from "@/lib/api-auth";
import type { GSTR3BGovJSON } from "@/types/gst-gov-types";

const ZERO_TAX = { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
const ZERO_ITC = { iamt: 0, camt: 0, samt: 0, csamt: 0 };

export async function GET(request: Request) {
  try {
    const { error } = await checkPermission("reports", "view");
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

    // ── Fetch company GSTIN ───────────────────────────────────────────────
    const gstinSetting = await db.appSetting.findUnique({
      where: { key: "company_gstin" },
    });
    const companyGstin = gstinSetting?.value || "";
    const companyStateCode = companyGstin.substring(0, 2);

    // ── 3.1(a) Outward: Sales invoices ────────────────────────────────────
    const salesInvoices = await db.invoice.findMany({
      where: { invoiceDate: dateFilter, paymentStatus: { not: "CANCELLED" } },
      include: {
        customer: { select: { gstin: true, state: true } },
        items: { select: { taxRate: true, amount: true, taxAmount: true } },
      },
    });

    // ── 3.1(a) Subtract: Sales returns ────────────────────────────────────
    const salesReturns = await db.salesReturn.findMany({
      where: { returnDate: dateFilter, status: "COMPLETED" },
      include: {
        customer: { select: { gstin: true, state: true } },
        items: { select: { taxRate: true, amount: true, taxAmount: true } },
      },
    });

    let osup_txval = 0, osup_igst = 0, osup_cgst = 0, osup_sgst = 0;

    // Rate-wise breakdown (for display)
    type RateRow = { rate: number; txval: number; igst: number; cgst: number; sgst: number };
    const rateMap = new Map<number, RateRow>();

    for (const inv of salesInvoices) {
      const custStateCode = getStateCode(inv.customer?.gstin, inv.customer?.state);
      osup_txval += Number(inv.subtotal);
      for (const it of inv.items) {
        const rate = Number(it.taxRate);
        const { igst, cgst, sgst } = splitGST(
          Number(it.taxAmount), companyStateCode, custStateCode
        );
        osup_igst += igst; osup_cgst += cgst; osup_sgst += sgst;

        if (!rateMap.has(rate)) rateMap.set(rate, { rate, txval: 0, igst: 0, cgst: 0, sgst: 0 });
        const r = rateMap.get(rate)!;
        r.txval += Number(it.amount);
        r.igst += igst; r.cgst += cgst; r.sgst += sgst;
      }
    }

    // Subtract returns from outward supplies
    for (const sr of salesReturns) {
      const custStateCode = getStateCode(sr.customer.gstin, sr.customer.state);
      osup_txval -= Number(sr.subtotal);
      for (const it of sr.items) {
        const { igst, cgst, sgst } = splitGST(
          Number(it.taxAmount), companyStateCode, custStateCode
        );
        osup_igst -= igst; osup_cgst -= cgst; osup_sgst -= sgst;
      }
    }

    // ── 4(A)(5) ITC Available — Purchase invoices ─────────────────────────
    const purchaseInvoices = await db.purchaseInvoice.findMany({
      where: { date: dateFilter, status: { not: "CANCELLED" } },
      include: {
        vendor: { select: { gstin: true, state: true } },
        items: { select: { taxRate: true, amount: true, taxAmount: true } },
      },
    });

    let itcAvl_igst = 0, itcAvl_cgst = 0, itcAvl_sgst = 0;
    for (const pi of purchaseInvoices) {
      const vendorStateCode = getStateCode(pi.vendor?.gstin, pi.vendor?.state);
      for (const it of pi.items) {
        const { igst, cgst, sgst } = splitGST(
          Number(it.taxAmount), companyStateCode, vendorStateCode
        );
        itcAvl_igst += igst; itcAvl_cgst += cgst; itcAvl_sgst += sgst;
      }
    }

    // ── 4(B)(2) ITC Reversed — Purchase returns ──────────────────────────
    const purchaseReturns = await db.purchaseReturn.findMany({
      where: { date: dateFilter, status: "COMPLETED" },
      include: {
        vendor: { select: { gstin: true, state: true } },
        items: { select: { taxRate: true, amount: true, taxAmount: true } },
      },
    });

    let itcRev_igst = 0, itcRev_cgst = 0, itcRev_sgst = 0;
    for (const pr of purchaseReturns) {
      const vendorStateCode = getStateCode(pr.vendor?.gstin, pr.vendor?.state);
      for (const it of pr.items) {
        const { igst, cgst, sgst } = splitGST(
          Number(it.taxAmount), companyStateCode, vendorStateCode
        );
        itcRev_igst += igst; itcRev_cgst += cgst; itcRev_sgst += sgst;
      }
    }

    const netITC_igst = round2(itcAvl_igst - itcRev_igst);
    const netITC_cgst = round2(itcAvl_cgst - itcRev_cgst);
    const netITC_sgst = round2(itcAvl_sgst - itcRev_sgst);

    // ── Inter-state B2C supplies (unregistered) grouped by POS ────────────
    const b2cInterMap = new Map<string, { pos: string; txval: number; iamt: number }>();
    for (const inv of salesInvoices) {
      if (inv.customer?.gstin) continue;
      const custStateCode = getStateCode(null, inv.customer?.state);
      if (!custStateCode || custStateCode === companyStateCode) continue;

      let invTxval = 0, invIgst = 0;
      for (const it of inv.items) {
        invTxval += Number(it.amount);
        invIgst += Number(it.taxAmount);
      }

      if (!b2cInterMap.has(custStateCode)) {
        b2cInterMap.set(custStateCode, { pos: custStateCode, txval: 0, iamt: 0 });
      }
      const e = b2cInterMap.get(custStateCode)!;
      e.txval = round2(e.txval + invTxval);
      e.iamt = round2(e.iamt + invIgst);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Assemble government JSON
    // ═══════════════════════════════════════════════════════════════════════
    const govJson: GSTR3BGovJSON = {
      gstin: companyGstin,
      ret_period: fmtFilingPeriod(month, year),
      sup_details: {
        osup_det: {
          txval: round2(osup_txval), iamt: round2(osup_igst),
          camt: round2(osup_cgst), samt: round2(osup_sgst), csamt: 0,
        },
        osup_zero: { ...ZERO_TAX },
        osup_nil_exmp: { ...ZERO_TAX },
        isup_rev: { ...ZERO_TAX },
        osup_nongst: { ...ZERO_TAX },
      },
      itc_elg: {
        itc_avl: [
          { ty: "IMPG", ...ZERO_ITC },
          { ty: "IMPS", ...ZERO_ITC },
          { ty: "ISRC", ...ZERO_ITC },
          { ty: "ISD", ...ZERO_ITC },
          { ty: "OTH", iamt: round2(itcAvl_igst), camt: round2(itcAvl_cgst), samt: round2(itcAvl_sgst), csamt: 0 },
        ],
        itc_rev: [
          { ty: "RUL", ...ZERO_ITC },
          { ty: "OTH", iamt: round2(itcRev_igst), camt: round2(itcRev_cgst), samt: round2(itcRev_sgst), csamt: 0 },
        ],
        itc_net: { iamt: netITC_igst, camt: netITC_cgst, samt: netITC_sgst, csamt: 0 },
        itc_inelg: [
          { ty: "RUL", ...ZERO_ITC },
          { ty: "OTH", ...ZERO_ITC },
        ],
      },
      inward_sup: {
        isup_details: [
          { ty: "GST", inter: 0, intra: 0 },
          { ty: "NONGST", inter: 0, intra: 0 },
        ],
      },
      intr_ltfee: { intr_details: { ...ZERO_ITC } },
      inter_sup: {
        unreg_details: Array.from(b2cInterMap.values()),
        comp_details: [],
        uin_details: [],
      },
    };

    // ═══════════════════════════════════════════════════════════════════════
    // Display data (for UI)
    // ═══════════════════════════════════════════════════════════════════════
    // Round rate-wise values
    const rateWise = Array.from(rateMap.values())
      .map((r) => ({
        rate: r.rate,
        txval: round2(r.txval), igst: round2(r.igst),
        cgst: round2(r.cgst), sgst: round2(r.sgst),
      }))
      .sort((a, b) => a.rate - b.rate);

    return NextResponse.json({
      period: { month: getMonthName(month), year },
      govJson,
      display: {
        outwardSupplies: {
          txval: round2(osup_txval), igst: round2(osup_igst),
          cgst: round2(osup_cgst), sgst: round2(osup_sgst),
          rateWise,
        },
        itc: {
          available: { igst: round2(itcAvl_igst), cgst: round2(itcAvl_cgst), sgst: round2(itcAvl_sgst) },
          reversed: { igst: round2(itcRev_igst), cgst: round2(itcRev_cgst), sgst: round2(itcRev_sgst) },
          net: { igst: netITC_igst, cgst: netITC_cgst, sgst: netITC_sgst },
        },
        taxPayable: {
          outputTax: { igst: round2(osup_igst), cgst: round2(osup_cgst), sgst: round2(osup_sgst) },
          itcNet: { igst: netITC_igst, cgst: netITC_cgst, sgst: netITC_sgst },
          netPayable: {
            igst: round2(round2(osup_igst) - netITC_igst),
            cgst: round2(round2(osup_cgst) - netITC_cgst),
            sgst: round2(round2(osup_sgst) - netITC_sgst),
            total: round2(
              round2(osup_igst) + round2(osup_cgst) + round2(osup_sgst) -
              netITC_igst - netITC_cgst - netITC_sgst
            ),
          },
        },
      },
    });
  } catch (err) {
    console.error("Error fetching GSTR-3B:", err);
    return NextResponse.json(
      { error: "Failed to fetch GSTR-3B report" },
      { status: 500 }
    );
  }
}
