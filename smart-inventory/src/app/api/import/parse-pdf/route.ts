import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/api-auth';

// pdf2json: pure-JS PDF parser that exposes per-character x/y positions.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFParser = require('pdf2json');

// ── Types ─────────────────────────────────────────────────

interface TextItem { x: number; y: number; text: string; }
interface PageRow  { y: number; items: TextItem[]; text: string; }

// Column with explicit left/right boundaries
interface Column {
  name: string;
  x: number;       // header x-position (center reference)
  left: number;    // left boundary
  right: number;   // right boundary
}

// ── PDF → positional rows ─────────────────────────────────

// Y-tolerance: items within this range are on the same visual line.
// pdf2json y-units are ~1/72 inch, so 0.3 ≈ 4px — tight enough to
// separate real rows but wide enough to catch slight vertical offsets.
const Y_TOLERANCE = 0.3;

async function extractRows(buffer: Buffer): Promise<PageRow[]> {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, 1);

    parser.on('pdfParser_dataReady', (data: Record<string, unknown>) => {
      const allRows: PageRow[] = [];

      for (const page of (data.Pages ?? []) as Record<string, unknown>[]) {
        const items: TextItem[] = [];

        for (const t of (page.Texts ?? []) as Record<string, unknown>[]) {
          const run = (t.R as Record<string, unknown>[])?.[0];
          const encoded = (run?.T as string) ?? '';
          let raw: string;
          try { raw = decodeURIComponent(encoded).trim(); }
          catch { raw = encoded.trim(); }
          if (!raw) continue;

          items.push({ x: t.x as number, y: t.y as number, text: raw });
        }

        // Cluster items by y-tolerance instead of rounding.
        // Sort by y, then group items within Y_TOLERANCE of the cluster start.
        items.sort((a, b) => a.y - b.y || a.x - b.x);
        const clusters: TextItem[][] = [];
        let currentCluster: TextItem[] = [];
        let clusterY = -Infinity;

        for (const item of items) {
          if (item.y - clusterY > Y_TOLERANCE) {
            if (currentCluster.length) clusters.push(currentCluster);
            currentCluster = [item];
            clusterY = item.y;
          } else {
            currentCluster.push(item);
          }
        }
        if (currentCluster.length) clusters.push(currentCluster);

        for (const cluster of clusters) {
          const sorted = cluster.sort((a, b) => a.x - b.x);
          const avgY = sorted.reduce((s, i) => s + i.y, 0) / sorted.length;
          allRows.push({
            y: avgY,
            items: sorted,
            text: sorted.map(i => i.text).join(' '),
          });
        }
      }

      resolve(allRows);
    });

    parser.on('pdfParser_dataError', (err: Record<string, unknown>) =>
      reject(err.parserError ?? new Error('pdf2json parse error'))
    );

    parser.parseBuffer(buffer);
  });
}

// ── Helpers ───────────────────────────────────────────────

function normDate(raw: string): string {
  const m = raw.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/);
  if (!m) return raw;
  const [, d, mo, y] = m;
  const year = y.length === 2 ? `20${y}` : y;
  return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ── Metadata extraction ───────────────────────────────────

function extractMeta(rows: PageRow[]) {
  // Only use early rows for metadata (before the table starts)
  // to avoid picking up noise from summary pages
  const headerRows = rows.slice(0, Math.min(rows.length, 30));
  const flat = headerRows.map(r => r.text).join(' ').replace(/\s{2,}/g, ' ');

  const invNo =
    flat.match(/(?:sap\s*ref(?:erence)?\s*no|tax\s*invoice\s*(?:no|number|#)|invoice\s*(?:no|number|#)|bill\s*(?:no|number|#)|gst\s*invoice\s*(?:no|number))[.\s:#]*([A-Z0-9/\-]{3,30})/i)?.[1]?.trim() ||
    flat.match(/\b((?:INV|SI|PI|BIL|BILL|GI|GST)[-/][A-Z0-9\-/]{2,25})\b/i)?.[1]?.trim() ||
    flat.match(/\b([A-Z0-9]{2,10}\/\d{4}(?:[–\-]\d{2,4})?\/[A-Z0-9]{3,15})\b/i)?.[1]?.trim() ||
    '';

  const rawDate =
    flat.match(/(?:invoice|bill)?\s*d(?:ate|t)\.?\s*[:\s]+(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})/i)?.[1] ||
    flat.match(/\bdate\s*[:\s]+(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})/i)?.[1] ||
    flat.match(/\b(\d{2}[./\-]\d{2}[./\-]\d{4})\b/)?.[1] ||
    '';
  const invoiceDate = normDate(rawDate);
  const dueDate = addDays(invoiceDate, 30);

  const partyName =
    flat.match(/([A-Z][A-Za-z\s&.]{2,60}(?:INDUSTRIES|FOODS?|PRODUCTS?|BEVERAGES?|BISCUITS?|CHEMICALS?|TRADERS?|ENTERPRISES?|LIMITED|LTD|PVT\.?\s*LTD|PRIVATE|CORP(?:ORATION)?|INC\.?)\.?)/)?.[1]
      ?.trim().replace(/\s+/g, ' ').replace(/[.,]+$/, '') || '';

  return { invoiceNumber: invNo, invoiceDate, dueDate, partyName };
}

// ── Header detection (multi-line aware) ──────────────────

const COL_KEYWORDS = /\b(sr\.?\s*no|pack\s*code|desc(?:ription)?|particulars|var|item|product|material|qty|quantity|rate|amount|total|hsn|uom|unit|tax|gst|sgst|cgst|igst|discount|discnt|disc|price|mrp|gross|net|taxable|value|sac|base|batch|pkt)\b/gi;

/**
 * Detect the header block — may span multiple y-rows.
 * Returns the start index and end index (exclusive) of header rows,
 * plus the merged header items.
 */
function detectHeaderBlock(rows: PageRow[]): { startIdx: number; endIdx: number; mergedHeaders: TextItem[] } | null {
  // Find the first row with 3+ column keywords
  let startIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const hits = (rows[i].text.match(COL_KEYWORDS) ?? []).length;
    if (hits >= 3) { startIdx = i; break; }
  }
  if (startIdx < 0) return null;

  // Expand the header block downward: include subsequent rows that
  // are also header-like (contain column keywords and NO numeric data values).
  // Stop when we hit a row that starts with a number (first data row).
  let endIdx = startIdx + 1;
  for (let i = startIdx + 1; i < Math.min(rows.length, startIdx + 5); i++) {
    const row = rows[i];
    // If row starts with a serial number (digit), it's data
    const firstItem = row.items[0];
    if (firstItem && /^\d+$/.test(firstItem.text.trim())) break;
    // If row has column keywords or is very short text (sub-headers like "%" or "Unit")
    const hasKeywords = (row.text.match(COL_KEYWORDS) ?? []).length >= 1;
    const isShortSubHeader = row.items.every(it => it.text.length <= 8);
    if (hasKeywords || isShortSubHeader) {
      endIdx = i + 1;
    } else {
      break;
    }
  }

  // Merge all header rows' items into columns by x-proximity.
  // Items at similar x-positions across header rows belong to the same column.
  const allHeaderItems: TextItem[] = [];
  for (let i = startIdx; i < endIdx; i++) {
    allHeaderItems.push(...rows[i].items);
  }

  // Group by x-proximity: items within X_HEADER_MERGE_TOLERANCE are the same column
  const X_HEADER_MERGE_TOLERANCE = 1.0;
  allHeaderItems.sort((a, b) => a.x - b.x);

  const mergedHeaders: TextItem[] = [];
  let currentGroup: TextItem[] = [];
  let groupX = -Infinity;

  for (const item of allHeaderItems) {
    if (item.x - groupX > X_HEADER_MERGE_TOLERANCE) {
      if (currentGroup.length) {
        // Merge group: combine text, use average x
        const avgX = currentGroup.reduce((s, i) => s + i.x, 0) / currentGroup.length;
        // Sort by y to get vertical order, then join
        currentGroup.sort((a, b) => a.y - b.y);
        const mergedText = currentGroup.map(i => i.text).join(' ').replace(/\s+/g, ' ').trim();
        mergedHeaders.push({ x: avgX, y: currentGroup[0].y, text: mergedText });
      }
      currentGroup = [item];
      groupX = item.x;
    } else {
      currentGroup.push(item);
    }
  }
  if (currentGroup.length) {
    const avgX = currentGroup.reduce((s, i) => s + i.x, 0) / currentGroup.length;
    currentGroup.sort((a, b) => a.y - b.y);
    const mergedText = currentGroup.map(i => i.text).join(' ').replace(/\s+/g, ' ').trim();
    mergedHeaders.push({ x: avgX, y: currentGroup[0].y, text: mergedText });
  }

  if (mergedHeaders.length < 2) return null;
  return { startIdx, endIdx, mergedHeaders };
}

// ── Column boundary computation ──────────────────────────

/**
 * Build columns with explicit left/right boundaries using midpoints.
 * Each column's territory extends from the midpoint to its left neighbor
 * to the midpoint to its right neighbor.
 */
function buildColumns(headers: TextItem[]): Column[] {
  const sorted = [...headers].sort((a, b) => a.x - b.x);
  const columns: Column[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const left = i === 0
      ? 0
      : (sorted[i - 1].x + sorted[i].x) / 2;
    const right = i === sorted.length - 1
      ? Infinity
      : (sorted[i].x + sorted[i + 1].x) / 2;

    columns.push({
      name: sorted[i].text,
      x: sorted[i].x,
      left,
      right,
    });
  }

  return columns;
}

/**
 * Map a data row's items to columns using boundary zones (not nearest-neighbor).
 * Each item falls into exactly one column based on x-position ranges.
 */
function mapToColumnsBounded(dataRow: PageRow, columns: Column[]): Record<string, string> {
  const cols: Record<string, string> = {};
  for (const item of dataRow.items) {
    const col = columns.find(c => item.x >= c.left && item.x < c.right);
    if (!col) continue;
    const key = col.name;
    cols[key] = cols[key] ? `${cols[key]} ${item.text}` : item.text;
  }
  return cols;
}

// ── Row filtering ─────────────────────────────────────────

/**
 * Check if a row is a repeated header (appears on page 2+ of multi-page invoices).
 * Compare against the header fingerprint — if 50%+ of keywords match, it's a repeat.
 */
function isRepeatedHeader(row: PageRow, headerFingerprint: Set<string>): boolean {
  const rowWords = new Set(
    row.text.toLowerCase().split(/\s+/)
      .filter(w => w.length > 2)
  );
  let matches = 0;
  for (const word of headerFingerprint) {
    if (rowWords.has(word)) matches++;
  }
  return headerFingerprint.size > 0 && matches >= Math.ceil(headerFingerprint.size * 0.4);
}

/**
 * Determine whether a row is a valid data row (not totals, summaries, footers).
 */
function isDataRow(row: PageRow): boolean {
  if (!row.text.trim()) return false;
  if (!/\d/.test(row.text)) return false;
  // Skip totals, summary lines, footer noise, page numbers
  if (/^\s*(total|sub[\s-]?total|grand[\s-]?total|net\s*(amount|invoice)|round[\s-]?off|taxable\s*invoice|cgst\s*(amount|@|tax)|sgst\s*(amount|@|tax)|igst\s*(amount|@|tax)|tax\s*amount|balance\s*due|freight|less\s*disc|e\.?\s*&\s*o|declaration|terms|bank\s*detail|page\s*\d|invoice\s*summary|product\s*category|surcharge|cheque\s*(amount|no)|dd\s*numbers?|adjusted|no\.?\s*of\s*(atc|l\/h|cbb)|total\s*units|transporter|eway|vehicle|g\.?c\.?\s*no|road\s*permit|gross\s*amount\s*in\s*words|date\s*and\s*time|authorised|we\s*hereby|certify|irn\s*no|annexure|doc\.?\s*no|remarks|dr\s*\/\s*cr|cr\s*\/\s*dr|tcs\s*collected)/i.test(row.text)) return false;
  return true;
}

/**
 * Check if a row is a continuation of the previous data row.
 * Continuation rows don't start with a serial number.
 */
function isContinuationRow(row: PageRow, firstColX: number, firstColRight: number): boolean {
  // Find items in the first column (Sr.No) zone
  const srItems = row.items.filter(it => it.x >= firstColX - 0.5 && it.x < firstColRight);
  if (srItems.length === 0) return true; // No Sr.No = continuation
  // If the first-column value is not a plain integer, it's a continuation
  const srText = srItems.map(i => i.text).join('').trim();
  return !/^\d+$/.test(srText);
}

// ── Main parse function ───────────────────────────────────

function parsePdfInvoice(rows: PageRow[], invoiceType: 'SALES' | 'PURCHASE') {
  if (!rows.length) return null;

  const meta = extractMeta(rows);

  // Detect multi-line header block
  const header = detectHeaderBlock(rows);
  if (!header) return null;

  const { startIdx, endIdx, mergedHeaders } = header;

  // Build column boundaries
  const columns = buildColumns(mergedHeaders);
  const colNames = columns.map(c => c.name);

  // Build header fingerprint for detecting repeated headers on later pages
  const headerFingerprint = new Set(
    mergedHeaders
      .flatMap(h => h.text.toLowerCase().split(/\s+/))
      .filter(w => w.length > 2)
  );

  // First column info for continuation-row detection
  const firstCol = columns[0];

  // Extract and merge data rows
  const dataRows: Record<string, string>[] = [];
  let currentRow: Record<string, string> | null = null;

  for (let i = endIdx; i < rows.length; i++) {
    const row = rows[i];

    // Skip repeated headers (page 2+ header repetition)
    if (isRepeatedHeader(row, headerFingerprint)) continue;

    // Skip non-data rows (totals, summaries, footers)
    if (!isDataRow(row)) continue;

    // Check if this is a continuation of the previous item
    if (currentRow && isContinuationRow(row, firstCol.x, firstCol.right)) {
      // Merge continuation data into the current row
      const contCols = mapToColumnsBounded(row, columns);
      for (const [key, val] of Object.entries(contCols)) {
        if (!val.trim()) continue;
        if (currentRow[key]) {
          currentRow[key] += ' ' + val;
        } else {
          currentRow[key] = val;
        }
      }
      continue;
    }

    // New data row — push the previous one and start fresh
    if (currentRow) {
      dataRows.push(currentRow);
    }
    currentRow = mapToColumnsBounded(row, columns);
  }
  // Push the last row
  if (currentRow) {
    dataRows.push(currentRow);
  }

  // Filter out rows that have no meaningful content
  const validRows = dataRows.filter(cols =>
    Object.values(cols).some(v => v.trim()) &&
    // Must have at least one numeric value (qty, rate, amount, etc.)
    Object.values(cols).some(v => /\d/.test(v))
  );

  if (validRows.length === 0) return null;

  const partyField = invoiceType === 'SALES' ? 'Customer Name' : 'Vendor Name';
  const dateField  = invoiceType === 'SALES' ? 'Invoice Date'  : 'Date';

  // Prepend metadata columns
  const metaHeaders = ['Invoice Number', dateField, 'Due Date', partyField];
  const allHeaders  = [...metaHeaders, ...colNames];

  const outRows = validRows.map(cols => ({
    'Invoice Number': meta.invoiceNumber,
    [dateField]:      meta.invoiceDate,
    'Due Date':       meta.dueDate,
    [partyField]:     meta.partyName,
    ...cols,
  }));

  const info = `Parsed from PDF — ${meta.partyName || 'Unknown'}. ${outRows.length} row(s) extracted.`;
  return { headers: allHeaders, rows: outRows, info };
}

// ── Route handler ─────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const { error } = await checkAuth();
    if (error) return error;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const invoiceType = (formData.get('invoiceType') as string) || 'PURCHASE';

    if (!file)
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!file.name.toLowerCase().endsWith('.pdf'))
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });

    const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_PDF_SIZE)
      return NextResponse.json({ error: 'File too large. Maximum size is 20MB.' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await extractRows(buffer);
    const result = parsePdfInvoice(rows, invoiceType as 'SALES' | 'PURCHASE');

    if (!result) {
      return NextResponse.json(
        { error: 'Could not extract invoice data from this PDF. No table with column headers was found. Try converting to Excel first.' },
        { status: 422 }
      );
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('PDF parse error:', err);
    const msg = err instanceof Error ? err.message : 'PDF parsing failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
