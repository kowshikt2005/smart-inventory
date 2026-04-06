import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getMonthDates,
  getMonthName,
  fmtGovDate,
  fmtFilingPeriod,
  splitGST,
  getStateCode,
  getSupplyType,
  toUQC,
  round2,
} from "@/lib/gst-report-utils";
import { checkPermission } from "@/lib/api-auth";
import type {
  GSTR1GovJSON,
  GovB2B,
  GovB2CS,
  GovCDNR,
  GovHSNEntry,
  GovDocDetail,
} from "@/types/gst-gov-types";

export async function GET(request: Request) {
  try {
    const { error } = await checkPermission('gst', 'view');
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

    // ── Fetch company GSTIN from settings ─────────────────────────────────
    const gstinSetting = await db.appSetting.findUnique({
      where: { key: "company_gstin" },
    });
    const companyGstin = gstinSetting?.value || "";
    const companyStateCode = companyGstin.substring(0, 2);

    // ── Fetch invoices (exclude CANCELLED) ────────────────────────────────
    const invoices = await db.invoice.findMany({
      where: { invoiceDate: dateFilter, paymentStatus: { not: "CANCELLED" } },
      include: {
        customer: { select: { gstin: true, name: true, state: true } },
        items: {
          include: {
            item: { select: { hsnCode: true, gstRate: true, unit: true, name: true } },
          },
        },
      },
      orderBy: { invoiceNumber: "asc" },
    });

    // ── Fetch sales returns (COMPLETED) ───────────────────────────────────
    const salesReturns = await db.salesReturn.findMany({
      where: { returnDate: dateFilter, status: "COMPLETED" },
      include: {
        customer: { select: { gstin: true, name: true, state: true } },
        invoice: { select: { invoiceNumber: true } },
        items: {
          include: {
            item: { select: { hsnCode: true, gstRate: true, unit: true, name: true } },
          },
        },
      },
      orderBy: { returnNumber: "asc" },
    });

    // ── Cancelled count (for doc_issue) ───────────────────────────────────
    const cancelledCount = await db.invoice.count({
      where: { invoiceDate: dateFilter, paymentStatus: "CANCELLED" },
    });

    // ═══════════════════════════════════════════════════════════════════════
    // B2B — Group by customer GSTIN
    // ═══════════════════════════════════════════════════════════════════════
    const b2bMap = new Map<string, GovB2B>();

    for (const inv of invoices) {
      if (!inv.customer?.gstin) continue;
      const ctin = inv.customer.gstin;
      const custStateCode = getStateCode(ctin, inv.customer.state);
      const pos = custStateCode || companyStateCode;

      let itemNum = 0;
      const itms = inv.items.map((it) => {
        itemNum++;
        const { igst, cgst, sgst } = splitGST(
          Number(it.taxAmount), companyStateCode, custStateCode
        );
        return {
          num: itemNum,
          itm_det: {
            txval: round2(Number(it.amount)),
            rt: Number(it.taxRate),
            iamt: igst, camt: cgst, samt: sgst, csamt: 0,
          },
        };
      });

      const b2bInvoice = {
        inum: inv.invoiceNumber,
        idt: fmtGovDate(inv.invoiceDate),
        val: round2(Number(inv.totalAmount)),
        pos,
        rchrg: "N" as const,
        inv_typ: "R" as const,
        itms,
      };

      if (!b2bMap.has(ctin)) b2bMap.set(ctin, { ctin, inv: [] });
      b2bMap.get(ctin)!.inv.push(b2bInvoice);
    }

    const b2b: GovB2B[] = Array.from(b2bMap.values());

    // ═══════════════════════════════════════════════════════════════════════
    // B2CS — Aggregate by sply_ty | pos | rate
    // ═══════════════════════════════════════════════════════════════════════
    const b2csMap = new Map<string, GovB2CS>();

    for (const inv of invoices) {
      if (!inv.customer) continue;
      if (inv.customer.gstin) continue;
      const custStateCode = getStateCode(null, inv.customer.state);
      const pos = custStateCode || companyStateCode;
      const splyTy = getSupplyType(companyStateCode, custStateCode);

      for (const it of inv.items) {
        const rate = Number(it.taxRate);
        const key = `${splyTy}|${pos}|${rate}`;
        const { igst, cgst, sgst } = splitGST(
          Number(it.taxAmount), companyStateCode, custStateCode
        );

        if (!b2csMap.has(key)) {
          b2csMap.set(key, {
            sply_ty: splyTy, pos, typ: "OE",
            txval: 0, rt: rate, iamt: 0, camt: 0, samt: 0, csamt: 0,
          });
        }
        const entry = b2csMap.get(key)!;
        entry.txval = round2(entry.txval + Number(it.amount));
        entry.iamt = round2(entry.iamt + igst);
        entry.camt = round2(entry.camt + cgst);
        entry.samt = round2(entry.samt + sgst);
      }
    }

    const b2cs: GovB2CS[] = Array.from(b2csMap.values());

    // ═══════════════════════════════════════════════════════════════════════
    // CDNR — Credit notes grouped by customer GSTIN
    // ═══════════════════════════════════════════════════════════════════════
    const cdnrMap = new Map<string, GovCDNR>();

    for (const sr of salesReturns) {
      if (!sr.customer.gstin) continue;
      const ctin = sr.customer.gstin;
      const custStateCode = getStateCode(ctin, sr.customer.state);
      const pos = custStateCode || companyStateCode;

      let itemNum = 0;
      const itms = sr.items.map((it) => {
        itemNum++;
        const { igst, cgst, sgst } = splitGST(
          Number(it.taxAmount), companyStateCode, custStateCode
        );
        return {
          num: itemNum,
          itm_det: {
            txval: round2(Number(it.amount)),
            rt: Number(it.taxRate),
            iamt: igst, camt: cgst, samt: sgst, csamt: 0,
          },
        };
      });

      const note = {
        nt_num: sr.returnNumber,
        nt_dt: fmtGovDate(sr.returnDate),
        ntty: "C" as const,
        val: round2(Number(sr.totalAmount)),
        rchrg: "N" as const,
        pos,
        inv_typ: "R" as const,
        itms,
      };

      if (!cdnrMap.has(ctin)) cdnrMap.set(ctin, { ctin, nt: [] });
      cdnrMap.get(ctin)!.nt.push(note);
    }

    const cdnr: GovCDNR[] = Array.from(cdnrMap.values());

    // ═══════════════════════════════════════════════════════════════════════
    // HSN — Split into B2B and B2C
    // ═══════════════════════════════════════════════════════════════════════
    type HSNAccum = {
      hsn_sc: string; uqc: string; rt: number;
      qty: number; txval: number; iamt: number; camt: number; samt: number;
    };
    const hsnB2BMap = new Map<string, HSNAccum>();
    const hsnB2CMap = new Map<string, HSNAccum>();

    for (const inv of invoices) {
      if (!inv.customer) continue;
      const custStateCode = getStateCode(inv.customer.gstin, inv.customer.state);
      const isB2B = !!inv.customer.gstin;
      const targetMap = isB2B ? hsnB2BMap : hsnB2CMap;

      for (const it of inv.items) {
        const hsnCode = it.item?.hsnCode || "99999999";
        const rate = Number(it.taxRate);
        const key = `${hsnCode}|${rate}`;
        const { igst, cgst, sgst } = splitGST(
          Number(it.taxAmount), companyStateCode, custStateCode
        );

        if (!targetMap.has(key)) {
          targetMap.set(key, {
            hsn_sc: hsnCode, uqc: toUQC(it.item?.unit), rt: rate,
            qty: 0, txval: 0, iamt: 0, camt: 0, samt: 0,
          });
        }
        const e = targetMap.get(key)!;
        e.qty = round2(e.qty + Number(it.quantity));
        e.txval = round2(e.txval + Number(it.amount));
        e.iamt = round2(e.iamt + igst);
        e.camt = round2(e.camt + cgst);
        e.samt = round2(e.samt + sgst);
      }
    }

    const toGovHSN = (map: Map<string, HSNAccum>): GovHSNEntry[] =>
      Array.from(map.values())
        .sort((a, b) => b.txval - a.txval)
        .map((e, idx) => ({ num: idx + 1, ...e, csamt: 0 }));

    const hsn = { hsn_b2b: toGovHSN(hsnB2BMap), hsn_b2c: toGovHSN(hsnB2CMap) };

    // ═══════════════════════════════════════════════════════════════════════
    // Document Issue Summary
    // ═══════════════════════════════════════════════════════════════════════
    const numericSort = (a: string, b: string) =>
      a.localeCompare(b, undefined, { numeric: true });

    const allInvNumbers = invoices
      .map((i) => i.invoiceNumber)
      .sort(numericSort);
    const allCNNumbers = salesReturns
      .map((sr) => sr.returnNumber)
      .sort(numericSort);

    const doc_det: GovDocDetail[] = [];

    if (allInvNumbers.length || cancelledCount) {
      doc_det.push({
        doc_num: 1,
        doc_typ: "Invoices for outward supply",
        docs: [{
          num: 1,
          from: allInvNumbers[0] || "-",
          to: allInvNumbers[allInvNumbers.length - 1] || "-",
          totnum: allInvNumbers.length + cancelledCount,
          cancel: cancelledCount,
          net_issue: allInvNumbers.length,
        }],
      });
    }

    if (allCNNumbers.length) {
      doc_det.push({
        doc_num: 5,
        doc_typ: "Credit Note",
        docs: [{
          num: 1,
          from: allCNNumbers[0],
          to: allCNNumbers[allCNNumbers.length - 1],
          totnum: allCNNumbers.length,
          cancel: 0,
          net_issue: allCNNumbers.length,
        }],
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Assemble government JSON
    // ═══════════════════════════════════════════════════════════════════════
    const govJson: GSTR1GovJSON = {
      gstin: companyGstin,
      fp: fmtFilingPeriod(month, year),
      b2b,
      b2cs,
      cdnr,
      hsn,
      doc_issue: { doc_det },
    };

    // ═══════════════════════════════════════════════════════════════════════
    // Display data (flat arrays for UI tables)
    // ═══════════════════════════════════════════════════════════════════════
    const displayB2B = invoices
      .filter((inv) => inv.customer?.gstin)
      .map((inv) => {
        const custStateCode = getStateCode(inv.customer!.gstin, inv.customer!.state);
        let txval = 0, igst = 0, cgst = 0, sgst = 0;
        for (const it of inv.items) {
          const t = splitGST(Number(it.taxAmount), companyStateCode, custStateCode);
          txval += Number(it.amount);
          igst += t.igst; cgst += t.cgst; sgst += t.sgst;
        }
        return {
          ctin: inv.customer!.gstin!,
          name: inv.customer!.name,
          inum: inv.invoiceNumber,
          idt: fmtGovDate(inv.invoiceDate),
          pos: custStateCode || companyStateCode,
          txval: round2(txval), igst: round2(igst),
          cgst: round2(cgst), sgst: round2(sgst),
          val: round2(Number(inv.totalAmount)),
        };
      });

    const displayCDNR = salesReturns
      .filter((sr) => sr.customer.gstin)
      .map((sr) => {
        const custStateCode = getStateCode(sr.customer.gstin, sr.customer.state);
        let txval = 0, igst = 0, cgst = 0, sgst = 0;
        for (const it of sr.items) {
          const t = splitGST(Number(it.taxAmount), companyStateCode, custStateCode);
          txval += Number(it.amount);
          igst += t.igst; cgst += t.cgst; sgst += t.sgst;
        }
        return {
          ctin: sr.customer.gstin!,
          name: sr.customer.name,
          nt_num: sr.returnNumber,
          nt_dt: fmtGovDate(sr.returnDate),
          ntty: "C" as const,
          pos: custStateCode || companyStateCode,
          txval: round2(txval), igst: round2(igst),
          cgst: round2(cgst), sgst: round2(sgst),
          val: round2(Number(sr.totalAmount)),
        };
      });

    const totalTxval = invoices.reduce((s, i) => s + Number(i.subtotal), 0);
    const totalTax = invoices.reduce((s, i) => s + Number(i.taxAmount), 0);

    return NextResponse.json({
      period: { month: getMonthName(month), year },
      govJson,
      display: {
        b2b: displayB2B,
        b2cs,
        cdnr: displayCDNR,
        hsn: { b2b: hsn.hsn_b2b, b2c: hsn.hsn_b2c },
        docIssue: doc_det,
        totalInvoices: allInvNumbers.length,
        totalCreditNotes: allCNNumbers.length,
        totalTxval: round2(totalTxval),
        totalTax: round2(totalTax),
      },
    });
  } catch (err) {
    console.error("Error fetching GSTR-1:", err);
    return NextResponse.json(
      { error: "Failed to fetch GSTR-1 report" },
      { status: 500 }
    );
  }
}
