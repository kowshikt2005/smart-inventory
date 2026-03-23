import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/api-auth';

// pdf2json: pure-JS PDF parser that exposes per-character x/y positions.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFParser = require('pdf2json');

// ── Types ─────────────────────────────────────────────────

interface TextItem { x: number; y: number; text: string; }
interface PageRow  { y: number; items: TextItem[]; text: string; }

// ── PDF → positional rows ─────────────────────────────────

/**
 * Parse the PDF buffer and return all text rows across all pages,
 * each row being the text items on a single visual line sorted left→right.
 */
async function extractRows(buffer: Buffer): Promise<PageRow[]> {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, 1);

    parser.on('pdfParser_dataReady', (data: Record<string, unknown>) => {
      const allRows: PageRow[] = [];

      for (const page of (data.Pages ?? []) as Record<string, unknown>[]) {
        const buckets = new Map<number, TextItem[]>();

        for (const t of (page.Texts ?? []) as Record<string, unknown>[]) {
          const run = (t.R as Record<string, unknown>[])?.[0];
          const encoded = (run?.T as string) ?? '';
          let raw: string;
          try { raw = decodeURIComponent(encoded).trim(); }
          catch { raw = encoded.trim(); }
          if (!raw) continue;

          const y = Math.round((t.y as number) * 10) / 10;
          if (!buckets.has(y)) buckets.set(y, []);
          buckets.get(y)!.push({ x: t.x as number, y: t.y as number, text: raw });
        }

        const sortedYs = [...buckets.keys()].sort((a, b) => a - b);
        for (const y of sortedYs) {
          const items = buckets.get(y)!.sort((a, b) => a.x - b.x);
          allRows.push({ y, items, text: items.map(i => i.text).join(' ') });
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
  const flat = rows.map(r => r.text).join(' ').replace(/\s{2,}/g, ' ');

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

// ── Column detection from PDF table ──────────────────────

/**
 * Find the table header row — a row containing 3+ column-label keywords
 * (desc, qty, rate, hsn, amount, etc.). Returns the row index or -1.
 */
function detectHeaderRow(rows: PageRow[]): number {
  const colKeywords = /\b(desc(?:ription)?|particulars|item|product|material|qty|quantity|rate|amount|total|hsn|uom|unit|tax|gst|sgst|cgst|igst|discount|disc|price|mrp|gross|net|taxable|value|sac)\b/gi;
  for (let i = 0; i < rows.length; i++) {
    const hits = (rows[i].text.match(colKeywords) ?? []).length;
    if (hits >= 3) return i;
  }
  return -1;
}

/**
 * Determine whether a row looks like an item data row.
 * Filters out totals, summaries, footers, and blank lines.
 */
function isDataRow(row: PageRow): boolean {
  if (!row.text.trim()) return false;
  if (!/\d/.test(row.text)) return false;
  // Skip totals / summary lines
  if (/^\s*(total|sub[\s-]?total|grand[\s-]?total|net\s*amount|round[\s-]?off|cgst\s*(amount|@|tax)|sgst\s*(amount|@|tax)|igst\s*(amount|@|tax)|tax\s*amount|balance\s*due|freight|less\s*disc|e\.?\s*&\s*o|declaration|terms|bank\s*detail|page\s*\d)/i.test(row.text)) return false;
  return true;
}

/**
 * Map a data row's text items to column names by finding the nearest
 * header item for each data item using x-coordinate proximity.
 */
function mapToColumns(dataRow: PageRow, headerItems: TextItem[]): Record<string, string> {
  const cols: Record<string, string> = {};
  for (const item of dataRow.items) {
    let nearest = headerItems[0];
    let minDist = Infinity;
    for (const h of headerItems) {
      const d = Math.abs(item.x - h.x);
      if (d < minDist) { minDist = d; nearest = h; }
    }
    const key = nearest.text;
    cols[key] = cols[key] ? `${cols[key]} ${item.text}` : item.text;
  }
  return cols;
}

// ── Main parse function ───────────────────────────────────

function parsePdfInvoice(rows: PageRow[], invoiceType: 'SALES' | 'PURCHASE') {
  if (!rows.length) return null;

  const meta = extractMeta(rows);

  // Detect the table header row to get real column names from the PDF
  const headerIdx = detectHeaderRow(rows);
  if (headerIdx < 0) return null;

  const headerItems = rows[headerIdx].items;
  if (headerItems.length < 2) return null;

  // Deduplicate column names — PDFs can emit the same label twice (e.g. two "SGST" text nodes)
  const seen = new Map<string, number>();
  const rawColNames = headerItems.map(h => {
    const base = h.text;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });

  // Extract data rows after the header using x-position column mapping
  const dataRows: Record<string, unknown>[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!isDataRow(row)) continue;
    const cols = mapToColumns(row, headerItems);
    if (!Object.values(cols).some(v => String(v).trim())) continue;
    dataRows.push(cols);
  }

  if (dataRows.length === 0) return null;

  const partyField = invoiceType === 'SALES' ? 'Customer Name' : 'Vendor Name';
  const dateField  = invoiceType === 'SALES' ? 'Invoice Date'  : 'Date';

  // Prepend metadata columns (derived from the invoice header block)
  const metaHeaders = ['Invoice Number', dateField, 'Due Date', partyField];
  const allHeaders  = [...metaHeaders, ...rawColNames];

  const outRows = dataRows.map(cols => ({
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
