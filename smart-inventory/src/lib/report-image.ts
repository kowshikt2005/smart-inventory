import sharp from "sharp";

interface InvoiceRow {
  invoiceNumber: string;
  invoiceDate: string;
  balanceAmount: number;
}

const GREEN = "#1B7A3D";
const LIGHT_GREEN = "#1F8C46";
const GRAY_BG = "#F0F0F0";
const WHITE = "#FFFFFF";
const DARK = "#222222";
const LIGHT_GRAY_TEXT = "#888888";

const WIDTH = 800;
const HEADER_H = 100;
const CUSTOMER_ROW_H = 40;
const TABLE_HEADER_H = 40;
const ROW_H = 36;
const FOOTER_H = 44;
const DISCLAIMER_H = 40;
const PAD = 24;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fmtAmount(n: number): string {
  return `Rs ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n))}`;
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Generate a PNG image buffer for an outstanding report — per customer.
 * Matches the prototype: green header, customer name row, invoice table, green total footer, disclaimer.
 */
export async function generateOutstandingImage(
  companyName: string,
  customerName: string,
  invoices: InvoiceRow[],
  totalOutstanding: number
): Promise<Buffer> {
  const dataRows = invoices.length;
  const totalH =
    HEADER_H + CUSTOMER_ROW_H + TABLE_HEADER_H + dataRows * ROW_H + FOOTER_H + DISCLAIMER_H;

  // ── Build SVG rows ──
  let tableRows = "";
  let y = HEADER_H + CUSTOMER_ROW_H + TABLE_HEADER_H;

  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    const bgColor = i % 2 === 0 ? WHITE : "#F9F9F9";
    tableRows += `
      <rect x="0" y="${y}" width="${WIDTH}" height="${ROW_H}" fill="${bgColor}"/>
      <text x="${PAD + 20}" y="${y + 24}" font-size="15" fill="${DARK}" font-family="Arial, Helvetica, sans-serif">${i + 1}</text>
      <text x="${PAD + 100}" y="${y + 24}" font-size="15" fill="${DARK}" font-family="Arial, Helvetica, sans-serif">${escapeXml(inv.invoiceNumber)}</text>
      <text x="${PAD + 350}" y="${y + 24}" font-size="15" fill="${DARK}" font-family="Arial, Helvetica, sans-serif">${fmtDate(inv.invoiceDate)}</text>
      <text x="${WIDTH - PAD - 20}" y="${y + 24}" font-size="15" fill="${DARK}" font-family="Arial, Helvetica, sans-serif" text-anchor="end">${fmtAmount(inv.balanceAmount)}</text>
    `;
    y += ROW_H;
  }

  const footerY = y;
  const disclaimerY = footerY + FOOTER_H;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${totalH}" viewBox="0 0 ${WIDTH} ${totalH}">
  <!-- White background -->
  <rect width="${WIDTH}" height="${totalH}" fill="${WHITE}"/>

  <!-- Green header -->
  <rect x="0" y="0" width="${WIDTH}" height="${HEADER_H}" fill="${GREEN}"/>
  <text x="${WIDTH / 2}" y="42" font-size="26" font-weight="bold" fill="${WHITE}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" letter-spacing="2">${escapeXml(companyName.toUpperCase())}</text>
  <text x="${WIDTH / 2}" y="76" font-size="16" fill="${WHITE}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" letter-spacing="3">PAYMENT REMINDER</text>

  <!-- Customer name row -->
  <rect x="0" y="${HEADER_H}" width="${WIDTH}" height="${CUSTOMER_ROW_H}" fill="${GRAY_BG}"/>
  <text x="${PAD}" y="${HEADER_H + 26}" font-size="14" font-weight="bold" fill="${DARK}" font-family="Arial, Helvetica, sans-serif">Customer Name: ${escapeXml(customerName)}</text>

  <!-- Table header -->
  <rect x="0" y="${HEADER_H + CUSTOMER_ROW_H}" width="${WIDTH}" height="${TABLE_HEADER_H}" fill="${WHITE}"/>
  <line x1="0" y1="${HEADER_H + CUSTOMER_ROW_H}" x2="${WIDTH}" y2="${HEADER_H + CUSTOMER_ROW_H}" stroke="#DDDDDD" stroke-width="1"/>
  <line x1="0" y1="${HEADER_H + CUSTOMER_ROW_H + TABLE_HEADER_H}" x2="${WIDTH}" y2="${HEADER_H + CUSTOMER_ROW_H + TABLE_HEADER_H}" stroke="#DDDDDD" stroke-width="1"/>
  <text x="${PAD + 20}" y="${HEADER_H + CUSTOMER_ROW_H + 26}" font-size="14" font-weight="bold" fill="#555555" font-family="Arial, Helvetica, sans-serif">No.</text>
  <text x="${PAD + 100}" y="${HEADER_H + CUSTOMER_ROW_H + 26}" font-size="14" font-weight="bold" fill="#555555" font-family="Arial, Helvetica, sans-serif">Invoice ID</text>
  <text x="${PAD + 350}" y="${HEADER_H + CUSTOMER_ROW_H + 26}" font-size="14" font-weight="bold" fill="#555555" font-family="Arial, Helvetica, sans-serif">Date</text>
  <text x="${WIDTH - PAD - 20}" y="${HEADER_H + CUSTOMER_ROW_H + 26}" font-size="14" font-weight="bold" fill="#555555" font-family="Arial, Helvetica, sans-serif" text-anchor="end">Amount</text>

  <!-- Table rows -->
  ${tableRows}

  <!-- Total footer -->
  <rect x="0" y="${footerY}" width="${WIDTH}" height="${FOOTER_H}" fill="${LIGHT_GREEN}"/>
  <text x="${PAD}" y="${footerY + 30}" font-size="18" font-weight="bold" fill="${WHITE}" font-family="Arial, Helvetica, sans-serif" letter-spacing="1">TOTAL OUTSTANDING</text>
  <text x="${WIDTH - PAD - 20}" y="${footerY + 30}" font-size="18" font-weight="bold" fill="${WHITE}" font-family="Arial, Helvetica, sans-serif" text-anchor="end">${fmtAmount(totalOutstanding)}</text>

  <!-- Disclaimer -->
  <rect x="0" y="${disclaimerY}" width="${WIDTH}" height="${DISCLAIMER_H}" fill="${WHITE}"/>
  <text x="${WIDTH / 2}" y="${disclaimerY + 26}" font-size="11" fill="${LIGHT_GRAY_TEXT}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-style="italic">This is an automated message for any clarification please contact ${escapeXml(companyName.toUpperCase())}</text>
</svg>`;

  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return pngBuffer;
}
