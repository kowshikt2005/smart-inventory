/**
 * PDF Invoice to XLSX Converter
 *
 * Extracts only invoice-relevant data from vendor tax invoice PDFs.
 * Outputs a clean single-sheet XLSX with header info + line items.
 *
 * Usage: npx tsx scripts/pdf-to-xlsx.ts <path-to-pdf> [output-path]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

interface InvoiceHeader {
  invoiceNo: string;
  invoiceDate: string;
  vendorName: string;
  vendorGstin: string;
  customerName: string;
  customerGstin: string;
  placeOfSupply: string;
}

interface LineItem {
  srNo: number;
  description: string;
  hsnCode: string;
  mrp: number;
  qty: number;
  rate: number;
  taxableValue: number;
  sgstPercent: number;
  sgstAmount: number;
  cgstPercent: number;
  cgstAmount: number;
  totalValue: number;
}

function parseNum(str: string): number {
  if (!str || str.trim() === '') return 0;
  return parseFloat(str.replace(/,/g, '').trim()) || 0;
}

function parseHeader(text: string): InvoiceHeader {
  const get = (pattern: RegExp, fallback = ''): string => {
    const m = text.match(pattern);
    return m ? m[1].trim() : fallback;
  };

  // Extract vendor GSTIN — look for the dispatch-from GSTIN (36AABCB...)
  const vendorGstin = get(/GSTIN\s*:\s*-?\s*(36AABCB\w+)/) || get(/36AABCB\w+/);

  // Extract customer name — after "NAME & ADDRESS" or "CUSTOMER NAME"
  let customerName = get(/CUSTOMER NAME\s*:\s*([^\n]+)/);
  if (!customerName) {
    // Britannia format: NAME & ADDRESS on one line, then FSSAI, then ": ACTUAL NAME,"
    customerName = get(/FSSAI[^\n]*\n\s*:\s*([^,\n]+)/);
  }

  return {
    invoiceNo: get(/SAP REFERENCE NO\s*:\s*(\d+)/),
    invoiceDate: get(/INVOICE DT\.\s*:\s*([\d.]+)/),
    vendorName: get(/STOCK DESPATCHED FROM\s*\n\s*[\w\s-]+,\s*\n\s*([^,\n]+)/) || 'BRITANNIA INDUSTRIES LIMITED',
    vendorGstin,
    customerName,
    customerGstin: get(/GSTIN\s*:\s*(36BPUPV\w+)/) || get(/GSTIN\s*:\s*(?!.*AABCB)([\w]+)/),
    placeOfSupply: get(/PLACE OF SUPPLY\s*:\s*([^\n]+)/),
  };
}

function parseLineItems(text: string): LineItem[] {
  const items: LineItem[] = [];

  // Primary regex: srNo packCode(CAT) description HSN batch MRP gstDisc unit pkt qty rate base discRs disc taxable sgst% sgstAmt cgst% cgstAmt gross
  const linePattern = /(\d+)\s+\d{7}\(\s*[A-Z]\)\s+([\s\S]*?)\s+(1905\d{4})\s+\w+\s+([\d.]+)\s+[\d.]+\s+\w+\s+\d+\s+(\d+)\s+([\d,.]+)\s+[\d,.]+\s+[\d,.]+\s+[\d,.]+\s+([\d,.]+)\s+([\d.]+)\s+([\d,.]+)\s+([\d.]+)\s+([\d,.]+)\s+([\d,.]+)/g;

  let match;
  while ((match = linePattern.exec(text)) !== null) {
    items.push({
      srNo: parseInt(match[1]),
      description: match[2].replace(/\s+/g, ' ').trim(),
      hsnCode: match[3],
      mrp: parseNum(match[4]),
      qty: parseInt(match[5]),
      rate: parseNum(match[6]),
      taxableValue: parseNum(match[7]),
      sgstPercent: parseNum(match[8]),
      sgstAmount: parseNum(match[9]),
      cgstPercent: parseNum(match[10]),
      cgstAmount: parseNum(match[11]),
      totalValue: parseNum(match[12]),
    });
  }

  // Fallback: line-by-line approach if primary regex didn't match
  if (items.length === 0) {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].match(/^\s*(\d{1,3})\s+\d{7}\(/)) continue;

      let combined = '';
      for (let j = 0; j < 4 && (i + j) < lines.length; j++) {
        combined += ' ' + lines[i + j];
      }
      combined = combined.replace(/\s+/g, ' ').trim();

      const m = combined.match(
        /(\d{1,3})\s+\d{7}\(\s*[A-Z]\)\s+(.*?)\s+(1905\d{4})\s+\w+\s+([\d.]+)\s+[\d.]+\s+\w+\s+\d+\s+(\d+)\s+([\d,.]+)\s+[\d,.]+\s+[\d,.]+\s+[\d,.]+\s+([\d,.]+)\s+([\d.]+)\s+([\d,.]+)\s+([\d.]+)\s+([\d,.]+)\s+([\d,.]+)/
      );

      if (m) {
        items.push({
          srNo: parseInt(m[1]),
          description: m[2].replace(/\s+/g, ' ').trim(),
          hsnCode: m[3],
          mrp: parseNum(m[4]),
          qty: parseInt(m[5]),
          rate: parseNum(m[6]),
          taxableValue: parseNum(m[7]),
          sgstPercent: parseNum(m[8]),
          sgstAmount: parseNum(m[9]),
          cgstPercent: parseNum(m[10]),
          cgstAmount: parseNum(m[11]),
          totalValue: parseNum(m[12]),
        });
      }
    }
  }

  // Deduplicate — page 2 repeats the table
  const seen = new Set<number>();
  return items.filter(item => {
    if (seen.has(item.srNo)) return false;
    seen.add(item.srNo);
    return true;
  });
}

function createWorkbook(header: InvoiceHeader, items: LineItem[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Compute totals from line items
  const totalTaxable = items.reduce((s, i) => s + i.taxableValue, 0);
  const totalSgst = items.reduce((s, i) => s + i.sgstAmount, 0);
  const totalCgst = items.reduce((s, i) => s + i.cgstAmount, 0);
  const totalValue = items.reduce((s, i) => s + i.totalValue, 0);
  const totalQty = items.reduce((s, i) => s + i.qty, 0);

  // Build single sheet: header rows at top, then line items table
  const rows: (string | number)[][] = [
    ['Invoice No', header.invoiceNo, '', 'Invoice Date', header.invoiceDate],
    ['Vendor', header.vendorName, '', 'Vendor GSTIN', header.vendorGstin],
    ['Customer', header.customerName, '', 'Customer GSTIN', header.customerGstin],
    ['Place of Supply', header.placeOfSupply],
    [],
    // Line items header
    ['Sr No', 'Description', 'HSN Code', 'MRP', 'Qty', 'Rate',
     'Taxable Value', 'SGST %', 'SGST Amt', 'CGST %', 'CGST Amt', 'Total'],
  ];

  // Line item rows
  for (const item of items) {
    rows.push([
      item.srNo, item.description, item.hsnCode, item.mrp, item.qty, item.rate,
      item.taxableValue, item.sgstPercent, item.sgstAmount,
      item.cgstPercent, item.cgstAmount, item.totalValue,
    ]);
  }

  // Totals row
  rows.push([]);
  rows.push([
    '', 'TOTAL', '', '', totalQty, '',
    totalTaxable, '', totalSgst, '', totalCgst, totalValue,
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 6 },  // Sr No
    { wch: 42 }, // Description
    { wch: 10 }, // HSN
    { wch: 8 },  // MRP
    { wch: 6 },  // Qty
    { wch: 12 }, // Rate
    { wch: 14 }, // Taxable
    { wch: 8 },  // SGST %
    { wch: 12 }, // SGST Amt
    { wch: 8 },  // CGST %
    { wch: 12 }, // CGST Amt
    { wch: 14 }, // Total
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Invoice');
  return wb;
}

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error('Usage: npx tsx scripts/pdf-to-xlsx.ts <pdf-path> [output-path]');
    process.exit(1);
  }

  const resolvedPath = path.resolve(pdfPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`Reading: ${resolvedPath}`);
  const pdfBuffer = fs.readFileSync(resolvedPath);
  const pdfData = await pdfParse(pdfBuffer);
  const text = pdfData.text;

  const header = parseHeader(text);
  const items = parseLineItems(text);

  console.log(`Invoice ${header.invoiceNo} | ${header.invoiceDate} | ${items.length} items`);

  if (items.length === 0) {
    console.error('No line items extracted. PDF format may not match expected pattern.');
    console.error('First 1500 chars of extracted text:\n');
    console.error(text.substring(0, 1500));
    process.exit(1);
  }

  const wb = createWorkbook(header, items);

  const outputPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : resolvedPath.replace(/\.pdf$/i, '.xlsx');

  XLSX.writeFile(wb, outputPath);
  console.log(`Saved: ${outputPath}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
