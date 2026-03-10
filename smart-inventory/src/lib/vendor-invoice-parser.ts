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
  sgst?: number;
  cgst?: number;
  igst?: number;
  packCode?: number;
}

function mapColumns(headerRow: unknown[]): ColMap {
  const col: ColMap = {};
  for (let c = 0; c < headerRow.length; c++) {
    const h = String(headerRow[c] ?? "")
      .toLowerCase()
      .replace(/[\n\r]+/g, " ")
      .trim();
    if (!h) continue;

    // Check tax columns first so "rate" doesn't match "tax rate"
    if (col.sgst === undefined && /sgst/.test(h) && /%/.test(h)) {
      col.sgst = c;
    } else if (col.cgst === undefined && /cgst/.test(h) && /%/.test(h)) {
      col.cgst = c;
    } else if (col.igst === undefined && /igst/.test(h) && /%/.test(h)) {
      col.igst = c;
    } else if (col.sr === undefined && /^sr|^s\.?\s*no|^sno|^#/.test(h)) {
      col.sr = c;
    } else if (col.hsn === undefined && /hsn/.test(h)) {
      col.hsn = c;
    } else if (
      col.qty === undefined &&
      /(qty|quantity)/.test(h)
    ) {
      col.qty = c;
    } else if (
      col.desc === undefined &&
      /(desc|particulars|var.*pack|product|item)/.test(h)
    ) {
      col.desc = c;
    } else if (
      col.rate === undefined &&
      /rate/.test(h) &&
      !/sgst|cgst|igst|tax/.test(h)
    ) {
      col.rate = c;
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
  qty: number;
  rate: number;
  tax: number;
  hsn: string;
}

function parseTax(row: unknown[], col: ColMap): number {
  let tax = 0;
  if (col.sgst !== undefined) tax += cleanNum(row[col.sgst]);
  if (col.cgst !== undefined) tax += cleanNum(row[col.cgst]);
  if (col.igst !== undefined) tax += cleanNum(row[col.igst]);
  return tax;
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

    const qty = cleanNum(row[col.qty!]);
    const rate = cleanNum(row[col.rate!]);
    if (qty <= 0 || rate <= 0) continue;

    const name =
      col.desc !== undefined ? String(row[col.desc] ?? "").trim() : "";
    if (!name) continue;

    items.push({
      name,
      qty,
      rate,
      tax: parseTax(row, col),
      hsn:
        col.hsn !== undefined ? String(row[col.hsn] ?? "").trim() : "",
    });
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
  const sgstLines = split(col.sgst);
  const cgstLines = split(col.cgst);
  const igstLines = split(col.igst);
  const packLines = split(col.packCode);

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

    let tax = 0;
    if (sgstLines[j]) tax += cleanNum(sgstLines[j]);
    if (cgstLines[j]) tax += cleanNum(cgstLines[j]);
    if (igstLines[j]) tax += cleanNum(igstLines[j]);

    items.push({ name, qty, rate, tax, hsn: hsnLines[j]?.trim() || "" });
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

      const qty = cleanNum(row[col.qty!]);
      const rate = cleanNum(row[col.rate!]);
      if (qty <= 0 || rate <= 0) continue;

      const name =
        col.desc !== undefined ? String(row[col.desc] ?? "").trim() : "";
      if (!name) continue;

      items.push({
        name,
        qty,
        rate,
        tax: parseTax(row, col),
        hsn:
          col.hsn !== undefined
            ? String(row[col.hsn] ?? "").trim()
            : "",
      });
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

    // ── Build flat output ──
    const headers = [
      "Invoice Number",
      "Date",
      "Due Date",
      "Vendor Name",
      "Item Name",
      "Quantity",
      "Rate",
      "Tax Rate %",
      "Notes",
      "Ref / Source",
    ];

    const rows: Record<string, unknown>[] = items.map((it) => ({
      "Invoice Number": invoiceNumber,
      Date: invoiceDate,
      "Due Date": dueDate,
      "Vendor Name": vendorName,
      "Item Name": it.name,
      Quantity: it.qty,
      Rate: it.rate,
      "Tax Rate %": it.tax,
      Notes: "",
      "Ref / Source": it.hsn ? `HSN:${it.hsn}` : "",
    }));

    const label = vendorName || "Unknown vendor";
    const info = `Auto-detected vendor invoice (${label}). Extracted ${items.length} items from ${sheetsUsed} sheet(s).`;

    return { headers, rows, info };
  } catch {
    return null;
  }
}
