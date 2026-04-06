/**
 * Auto-detects PDF-to-Excel vendor invoices and converts them to flat rows
 * for the import system. Works with common Indian tax invoice formats
 * (Britannia, HUL, ITC, etc.) that share a similar layout:
 *   Row 0 = merged header block with metadata
 *   Row 1 = column headers
 *   Row 2+ = line items (with possible continuation rows)
 *   Sheet 2+ = overflow items (sometimes merged into single rows)
 */

import * as XLSX from "xlsx";

export interface VendorInvoiceParseResult {
  headers: string[];
  rows: Record<string, unknown>[];
  info: string;
}

// ── Helpers ──────────────────────────────────────────────

function cleanNum(v: unknown): number {
  return parseFloat(String(v ?? "0").replace(/,/g, "")) || 0;
}

function cleanStr(v: unknown): string {
  return String(v ?? "").replace(/[\n\r]+/g, " ").trim();
}

function parseDateStr(s: string): string {
  // DD.MM.YYYY or DD/MM/YYYY → YYYY-MM-DD
  for (const sep of [".", "/"]) {
    const parts = s.split(sep);
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
  }
  return s;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// ── Column detection ─────────────────────────────────────

interface ColMap {
  sr?: number;
  desc?: number;
  hsn?: number;
  qty?: number;
  rate?: number;
  sgstPct?: number;
  cgstPct?: number;
  igstPct?: number;
  sgstAmt?: number;
  cgstAmt?: number;
  igstAmt?: number;
  packCode?: number;
  mrp?: number;
  gstDisc?: number;
  unit?: number;
  noOfPkt?: number;
  baseValue?: number;
  discountRs?: number;
  discount?: number;
  taxableValue?: number;
  grossValue?: number;
  batchNo?: number;
}

function mapColumns(headerRow: unknown[]): ColMap {
  const col: ColMap = {};
  for (let c = 0; c < headerRow.length; c++) {
    const h = String(headerRow[c] ?? "")
      .toLowerCase()
      .replace(/[\n\r]+/g, " ")
      .trim();
    if (!h) continue;

    // ── Tax % columns (check before "rate" to avoid false match) ──
    if (col.sgstPct === undefined && /sgst/.test(h) && /%/.test(h)) {
      col.sgstPct = c;
    } else if (col.cgstPct === undefined && /cgst/.test(h) && /%/.test(h)) {
      col.cgstPct = c;
    } else if (col.igstPct === undefined && /igst/.test(h) && /%/.test(h)) {
      col.igstPct = c;
    }
    // ── Tax amount columns ──
    else if (col.sgstAmt === undefined && /sgst/.test(h) && /am(ou)?nt|value|rs|₹/i.test(h)) {
      col.sgstAmt = c;
    } else if (col.cgstAmt === undefined && /cgst/.test(h) && /am(ou)?nt|value|rs|₹/i.test(h)) {
      col.cgstAmt = c;
    } else if (col.igstAmt === undefined && /igst/.test(h) && /am(ou)?nt|value|rs|₹/i.test(h)) {
      col.igstAmt = c;
    }
    // ── Standard columns ──
    else if (col.sr === undefined && /^sr|^s\.?\s*no|^sno|^#/.test(h)) {
      col.sr = c;
    } else if (col.hsn === undefined && /hsn/.test(h)) {
      col.hsn = c;
    } else if (col.batchNo === undefined && /batch/.test(h)) {
      col.batchNo = c;
    } else if (col.mrp === undefined && /mrp/.test(h)) {
      col.mrp = c;
    } else if (col.gstDisc === undefined && /gst\s*disc/.test(h)) {
      col.gstDisc = c;
    } else if (col.unit === undefined && /^unit$/.test(h)) {
      col.unit = c;
    } else if (col.noOfPkt === undefined && /(no\.?\s*of|pkt|pack)/.test(h) && /(unit|pkt|pack)/i.test(h)) {
      col.noOfPkt = c;
    } else if (col.qty === undefined && /(qty|quantity)/.test(h)) {
      col.qty = c;
    } else if (col.desc === undefined && /(desc|particulars|var.*pack|product|item)/.test(h)) {
      col.desc = c;
    } else if (col.rate === undefined && /rate/.test(h) && !/sgst|cgst|igst|tax/.test(h)) {
      col.rate = c;
    } else if (col.baseValue === undefined && /base\s*value|basic\s*value/i.test(h)) {
      col.baseValue = c;
    } else if (col.discountRs === undefined && /disc(?:ou)?nt?\s*rs|disc(?:ou)?nt?\s*am/i.test(h)) {
      col.discountRs = c;
    } else if (col.discount === undefined && /disc(?:ou)?nt?\b/i.test(h) && !/rs|amount/i.test(h)) {
      col.discount = c;
    } else if (col.taxableValue === undefined && /taxable/i.test(h)) {
      col.taxableValue = c;
    } else if (col.grossValue === undefined && /gross\s*value|gross\s*am|total\s*value|net\s*value/i.test(h)) {
      col.grossValue = c;
    } else if (col.packCode === undefined && /pack.*code/.test(h)) {
      col.packCode = c;
    }
  }
  return col;
}

/** Find the column-header row (many short cells vs. the big merged header). */
function findHeaderRow(raw: unknown[][]): number {
  for (let i = 0; i < Math.min(raw.length, 5); i++) {
    const row = raw[i] as unknown[];
    if (!row) continue;
    const cells = row.filter((c) => c != null && String(c).trim() !== "");
    if (cells.length < 5) continue;
    const avgLen =
      cells.reduce((s: number, c: unknown) => s + String(c).length, 0) / cells.length;
    if (avgLen < 40) return i;
  }
  return -1;
}

// ── Line-item type ───────────────────────────────────────

interface LineItem {
  name: string;
  packCode: string;
  hsn: string;
  batchNo: string;
  mrp: number;
  gstDisc: number;
  unit: string;
  noOfPkt: number;
  qty: number;
  rate: number;
  baseValue: number;
  discountRs: number;
  discount: number;
  taxableValue: number;
  sgstPct: number;
  sgstAmt: number;
  cgstPct: number;
  cgstAmt: number;
  igstPct: number;
  igstAmt: number;
  grossValue: number;
}

function extractLineItem(row: unknown[], col: ColMap): LineItem | null {
  const qty = cleanNum(row[col.qty!]);
  const rate = cleanNum(row[col.rate!]);
  if (qty <= 0 || rate <= 0) return null;

  const name = col.desc !== undefined ? cleanStr(row[col.desc]) : "";
  if (!name) return null;

  return {
    name,
    packCode: col.packCode !== undefined ? cleanStr(row[col.packCode]) : "",
    hsn: col.hsn !== undefined ? cleanStr(row[col.hsn]) : "",
    batchNo: col.batchNo !== undefined ? cleanStr(row[col.batchNo]) : "",
    mrp: col.mrp !== undefined ? cleanNum(row[col.mrp]) : 0,
    gstDisc: col.gstDisc !== undefined ? cleanNum(row[col.gstDisc]) : 0,
    unit: col.unit !== undefined ? cleanStr(row[col.unit]) : "",
    noOfPkt: col.noOfPkt !== undefined ? cleanNum(row[col.noOfPkt]) : 0,
    qty,
    rate,
    baseValue: col.baseValue !== undefined ? cleanNum(row[col.baseValue]) : 0,
    discountRs: col.discountRs !== undefined ? cleanNum(row[col.discountRs]) : 0,
    discount: col.discount !== undefined ? cleanNum(row[col.discount]) : 0,
    taxableValue: col.taxableValue !== undefined ? cleanNum(row[col.taxableValue]) : 0,
    sgstPct: col.sgstPct !== undefined ? cleanNum(row[col.sgstPct]) : 0,
    sgstAmt: col.sgstAmt !== undefined ? cleanNum(row[col.sgstAmt]) : 0,
    cgstPct: col.cgstPct !== undefined ? cleanNum(row[col.cgstPct]) : 0,
    cgstAmt: col.cgstAmt !== undefined ? cleanNum(row[col.cgstAmt]) : 0,
    igstPct: col.igstPct !== undefined ? cleanNum(row[col.igstPct]) : 0,
    igstAmt: col.igstAmt !== undefined ? cleanNum(row[col.igstAmt]) : 0,
    grossValue: col.grossValue !== undefined ? cleanNum(row[col.grossValue]) : 0,
  };
}

// ── Sheet parsers ────────────────────────────────────────

function parseNormalRows(
  raw: unknown[][],
  headerIdx: number,
  col: ColMap
): LineItem[] {
  const items: LineItem[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i] as unknown[];
    if (!row) continue;

    // Skip continuation rows (Sr.No must be a number)
    if (col.sr !== undefined && typeof row[col.sr] !== "number") continue;

    const item = extractLineItem(row, col);
    if (item) items.push(item);
  }
  return items;
}

function parseMergedRow(
  row: unknown[],
  count: number,
  col: ColMap
): LineItem[] {
  const split = (idx: number | undefined) =>
    idx !== undefined ? String(row[idx] ?? "").split("\n") : [];

  const qtyLines = split(col.qty);
  const rateLines = split(col.rate);
  const descLines = split(col.desc);
  const hsnLines = split(col.hsn);
  const batchLines = split(col.batchNo);
  const packLines = split(col.packCode);
  const sgstPctLines = split(col.sgstPct);
  const cgstPctLines = split(col.cgstPct);
  const igstPctLines = split(col.igstPct);
  const sgstAmtLines = split(col.sgstAmt);
  const cgstAmtLines = split(col.cgstAmt);
  const igstAmtLines = split(col.igstAmt);
  const mrpLines = split(col.mrp);
  const baseLines = split(col.baseValue);
  const discRsLines = split(col.discountRs);
  const discLines = split(col.discount);
  const taxableLines = split(col.taxableValue);
  const grossLines = split(col.grossValue);
  const unitLines = split(col.unit);
  const pktLines = split(col.noOfPkt);

  const usePackCodes = descLines.length < count && packLines.length >= count;
  const items: LineItem[] = [];

  for (let j = 0; j < count; j++) {
    const qty = cleanNum(qtyLines[j]);
    const rate = cleanNum(rateLines[j]);
    if (qty <= 0 || rate <= 0) continue;

    const name = usePackCodes
      ? packLines[j]?.replace(/\s*\([^)]*\)/g, "").trim() || ""
      : descLines[j]?.trim() ||
        packLines[j]?.replace(/\s*\([^)]*\)/g, "").trim() ||
        "";
    if (!name) continue;

    items.push({
      name,
      packCode: packLines[j]?.trim() || "",
      hsn: hsnLines[j]?.trim() || "",
      batchNo: batchLines[j]?.trim() || "",
      mrp: cleanNum(mrpLines[j]),
      gstDisc: 0,
      unit: unitLines[j]?.trim() || "",
      noOfPkt: cleanNum(pktLines[j]),
      qty,
      rate,
      baseValue: cleanNum(baseLines[j]),
      discountRs: cleanNum(discRsLines[j]),
      discount: cleanNum(discLines[j]),
      taxableValue: cleanNum(taxableLines[j]),
      sgstPct: cleanNum(sgstPctLines[j]),
      sgstAmt: cleanNum(sgstAmtLines[j]),
      cgstPct: cleanNum(cgstPctLines[j]),
      cgstAmt: cleanNum(cgstAmtLines[j]),
      igstPct: cleanNum(igstPctLines[j]),
      igstAmt: cleanNum(igstAmtLines[j]),
      grossValue: cleanNum(grossLines[j]),
    });
  }
  return items;
}

function parseOverflowSheet(
  workbook: XLSX.WorkBook,
  sheetIdx: number
): LineItem[] {
  const sheet = workbook.Sheets[workbook.SheetNames[sheetIdx]];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const hIdx = findHeaderRow(raw);
  if (hIdx < 0) return [];

  const col = mapColumns(raw[hIdx] as unknown[]);
  if (col.qty === undefined || col.rate === undefined) return [];

  const items: LineItem[] = [];

  for (let i = hIdx + 1; i < raw.length; i++) {
    const row = raw[i] as unknown[];
    if (!row) continue;

    // Check for merged rows (newline-separated Sr.No)
    const srCell =
      col.sr !== undefined ? String(row[col.sr] ?? "") : "";
    const srLines = srCell.split("\n").filter((l) => l.trim());

    if (srLines.length > 1) {
      items.push(...parseMergedRow(row, srLines.length, col));
    } else {
      // Normal single row — check Sr.No is numeric
      if (col.sr !== undefined) {
        const v = row[col.sr];
        if (
          v == null ||
          (typeof v !== "number" && isNaN(Number(String(v).trim())))
        )
          continue;
      }

      const item = extractLineItem(row, col);
      if (item) items.push(item);
    }
  }

  return items;
}

// ── Main entry point ─────────────────────────────────────

export function tryParseVendorInvoice(
  workbook: XLSX.WorkBook
): VendorInvoiceParseResult | null {
  try {
    const sheet1 = workbook.Sheets[workbook.SheetNames[0]];
    const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet1, {
      header: 1,
    });

    if (raw.length < 3) return null;

    // ── Detection: first cell is a large merged block containing "invoice" ──
    const firstCell = String((raw[0] as unknown[])?.[0] ?? "");
    if (firstCell.length < 80 || !/invoice|bill\s*no/i.test(firstCell))
      return null;

    // ── Extract metadata ──
    const row0 = raw[0] as unknown[];
    const allText = row0.map((c) => String(c ?? "")).join(" ");
    const lastCellText = String(row0[row0.length - 1] ?? "");

    const invoiceNumber =
      allText.match(/SAP\s*REFERENCE\s*NO\.?\s*:\s*(\S+)/i)?.[1] ||
      allText.match(/INVOICE\s*NO\.?\s*:\s*(\S+)/i)?.[1] ||
      allText.match(/BILL\s*NO\.?\s*:\s*(\S+)/i)?.[1] ||
      "";

    const rawDate =
      allText.match(/INVOICE\s*DT\.?\s*:\s*([\d./-]+)/i)?.[1] ||
      allText.match(/BILL\s*DT\.?\s*:\s*([\d./-]+)/i)?.[1] ||
      "";
    const invoiceDate = parseDateStr(rawDate);
    const dueDate = addDays(invoiceDate, 30);

    // Extract vendor name — try after GSTIN pattern first to avoid capturing GSTIN chars
    const vendorName =
      lastCellText
        .match(/\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d]{2}\s+([A-Z][A-Z\s]+?(?:LIMITED|LTD)\.?)/i)?.[1]
        ?.trim() ||
      lastCellText
        .match(/([A-Z]{3,}(?:\s+[A-Z]{2,})+\s+(?:LIMITED|LTD)\.?)/i)?.[1]
        ?.trim() ||
      allText
        .match(/([A-Z]{3,}(?:\s+[A-Z]{2,})+\s+(?:LIMITED|LTD)\.?)/i)?.[1]
        ?.trim() ||
      "";

    // ── Find columns on Sheet 1 ──
    const headerIdx = findHeaderRow(raw);
    if (headerIdx < 0) return null;

    const col = mapColumns(raw[headerIdx] as unknown[]);
    if (col.qty === undefined || col.rate === undefined) return null;

    // ── Collect items from all sheets ──
    const items: LineItem[] = parseNormalRows(raw, headerIdx, col);
    let sheetsUsed = 1;

    for (let s = 1; s < workbook.SheetNames.length; s++) {
      const overflow = parseOverflowSheet(workbook, s);
      if (overflow.length > 0) {
        items.push(...overflow);
        sheetsUsed++;
      }
    }

    if (items.length === 0) return null;

    // ── Build flat output using RAW column names from the Excel file ──
    // Read the actual header text from the file's header row
    const rawHeaderRow = (raw[headerIdx] as unknown[]).map(c =>
      String(c ?? "").replace(/[\n\r]+/g, " ").trim()
    );

    // Map each ColMap field → LineItem getter, in display order
    const fieldDefs: { colKey: keyof ColMap; getter: (it: LineItem) => unknown }[] = [
      { colKey: "packCode", getter: (it) => it.packCode },
      { colKey: "desc", getter: (it) => it.name },
      { colKey: "hsn", getter: (it) => it.hsn },
      { colKey: "batchNo", getter: (it) => it.batchNo },
      { colKey: "mrp", getter: (it) => it.mrp },
      { colKey: "gstDisc", getter: (it) => it.gstDisc },
      { colKey: "unit", getter: (it) => it.unit },
      { colKey: "noOfPkt", getter: (it) => it.noOfPkt },
      { colKey: "qty", getter: (it) => it.qty },
      { colKey: "rate", getter: (it) => it.rate },
      { colKey: "baseValue", getter: (it) => it.baseValue },
      { colKey: "discountRs", getter: (it) => it.discountRs },
      { colKey: "discount", getter: (it) => it.discount },
      { colKey: "taxableValue", getter: (it) => it.taxableValue },
      { colKey: "sgstPct", getter: (it) => it.sgstPct },
      { colKey: "sgstAmt", getter: (it) => it.sgstAmt },
      { colKey: "cgstPct", getter: (it) => it.cgstPct },
      { colKey: "cgstAmt", getter: (it) => it.cgstAmt },
      { colKey: "igstPct", getter: (it) => it.igstPct },
      { colKey: "igstAmt", getter: (it) => it.igstAmt },
      { colKey: "grossValue", getter: (it) => it.grossValue },
    ];

    // Metadata headers (extracted from merged header block, not from columns)
    const headers: string[] = [
      "Invoice Number",
      "Date",
      "Due Date",
      "Vendor Name",
    ];

    // Build active fields list using the RAW header names from the file
    const activeFields: { rawHeader: string; getter: (it: LineItem) => unknown }[] = [];
    const detectedIndices = new Set<number>();
    for (const { colKey, getter } of fieldDefs) {
      const idx = col[colKey];
      if (idx === undefined) continue;
      const name = rawHeaderRow[idx];
      if (!name) continue;
      // Avoid duplicate headers (e.g. if two fields map to same column)
      if (headers.includes(name)) continue;
      headers.push(name);
      activeFields.push({ rawHeader: name, getter });
      detectedIndices.add(idx);
    }

    // Also include any raw columns the parser didn't recognize
    // so the user can manually map them
    for (let i = 0; i < rawHeaderRow.length; i++) {
      if (!rawHeaderRow[i]) continue;
      if (detectedIndices.has(i)) continue;
      if (col.sr !== undefined && i === col.sr) continue; // skip Sr No
      headers.push(rawHeaderRow[i]);
    }

    const rows: Record<string, unknown>[] = items.map((it) => {
      const row: Record<string, unknown> = {
        "Invoice Number": invoiceNumber,
        Date: invoiceDate,
        "Due Date": dueDate,
        "Vendor Name": vendorName,
      };
      for (const { rawHeader, getter } of activeFields) {
        row[rawHeader] = getter(it);
      }
      return row;
    });

    const label = vendorName || "Unknown vendor";
    const info = `Auto-detected vendor invoice (${label}). Extracted ${items.length} items from ${sheetsUsed} sheet(s).`;

    return { headers, rows, info };
  } catch {
    return null;
  }
}
