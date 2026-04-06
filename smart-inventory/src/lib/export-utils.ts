import { utils, writeFileXLSX } from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CompanySettings, BankAccountInfo } from "./invoice-pdf";

// ── Types ──────────────────────────────────────────────────────
interface SheetConfig {
  name: string;
  headers: string[];
  rows: (string | number)[][];
}

interface ExcelConfig {
  fileName: string;
  sheets: SheetConfig[];
  company?: CompanySettings | null;
}

interface PDFConfig {
  fileName: string;
  title: string;
  subtitle?: string;
  companyName?: string;
  company?: CompanySettings | null;
  orientation?: "portrait" | "landscape";
  sheets: SheetConfig[];
}

// ── Colors ─────────────────────────────────────────────────────
const BLUE: [number, number, number] = [37, 99, 175];
const WHITE: [number, number, number] = [255, 255, 255];
const GRAY_TEXT: [number, number, number] = [100, 100, 100];

// ── Fetch company settings (shared utility) ───────────────────
export async function fetchCompanySettings(): Promise<{
  company: CompanySettings;
  bank: BankAccountInfo | null;
}> {
  const [settingsRes, bankRes] = await Promise.all([
    fetch("/api/settings"),
    fetch("/api/bank-accounts"),
  ]);
  const settingsArr = await settingsRes.json();
  const bankData = await bankRes.json();

  const settingsMap: Record<string, string> = {};
  for (const s of settingsArr) settingsMap[s.key] = s.value;

  const company: CompanySettings = {
    company_name: settingsMap.company_name || "",
    company_address: settingsMap.company_address || "",
    company_city: settingsMap.company_city || "",
    company_state: settingsMap.company_state || "",
    company_pincode: settingsMap.company_pincode || "",
    company_phone: settingsMap.company_phone || "",
    company_email: settingsMap.company_email || "",
    company_gstin: settingsMap.company_gstin || "",
    company_pan: settingsMap.company_pan || "",
    company_msme: settingsMap.company_msme || "",
    company_fssai: settingsMap.company_fssai || "",
  };

  const bankAccounts = bankData.bankAccounts || bankData || [];
  const bank: BankAccountInfo | null =
    (Array.isArray(bankAccounts)
      ? bankAccounts.find((b: { isDefault?: boolean }) => b.isDefault) || bankAccounts[0]
      : null) || null;

  return { company, bank };
}

// ── Excel Export ───────────────────────────────────────────────
export function exportToExcel({ fileName, sheets, company }: ExcelConfig) {
  const workbook = utils.book_new();

  for (const sheet of sheets) {
    // Build header rows with company info
    const headerRows: (string | number)[][] = [];
    if (company?.company_name) {
      headerRows.push([company.company_name]);
      const addressParts = [
        company.company_address,
        [company.company_city, company.company_state, company.company_pincode].filter(Boolean).join(", "),
      ].filter(Boolean);
      if (addressParts.length) headerRows.push([addressParts.join(", ")]);
      const detailParts: string[] = [];
      if (company.company_phone) detailParts.push("Phone: " + company.company_phone);
      if (company.company_email) detailParts.push("Email: " + company.company_email);
      if (detailParts.length) headerRows.push([detailParts.join(" | ")]);
      if (company.company_gstin) headerRows.push(["GSTIN: " + company.company_gstin]);
      // Blank separator row
      headerRows.push([]);
    }

    const data = [...headerRows, sheet.headers, ...sheet.rows];
    const worksheet = utils.aoa_to_sheet(data);

    // Auto-size columns
    worksheet["!cols"] = sheet.headers.map((h, i) => ({
      wch: Math.max(
        h.length,
        ...sheet.rows.map((r) => String(r[i] ?? "").length)
      ) + 2,
    }));

    // Merge company name across all columns
    if (company?.company_name && sheet.headers.length > 1) {
      const lastCol = sheet.headers.length - 1;
      worksheet["!merges"] = headerRows.map((_, rowIdx) => ({
        s: { r: rowIdx, c: 0 },
        e: { r: rowIdx, c: lastCol },
      }));
    }

    utils.book_append_sheet(workbook, worksheet, sheet.name.substring(0, 31));
  }

  writeFileXLSX(workbook, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}

// ── Internal: build a jsPDF document without saving ───────────
function buildPDFDocument({
  title,
  subtitle,
  companyName,
  company,
  orientation = "portrait",
  sheets,
}: Omit<PDFConfig, "fileName">): jsPDF {
  const doc = new jsPDF({ orientation });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ml = 10;
  const mr = 10;

  let y = 12;

  if (company?.company_name) {
    // ── Full company header (matches invoice-pdf style) ──────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(company.company_name, ml, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY_TEXT);

    const lines: string[] = [];
    if (company.company_address) lines.push(company.company_address);
    const cityLine = [company.company_city, company.company_state, company.company_pincode]
      .filter(Boolean)
      .join(", ");
    if (cityLine) lines.push(cityLine);
    if (company.company_phone) lines.push("Phone: " + company.company_phone);
    if (company.company_email) lines.push("Email: " + company.company_email);
    if (company.company_gstin) lines.push("GSTIN: " + company.company_gstin);

    for (const line of lines) {
      doc.text(line, ml, y);
      y += 3.5;
    }

    // ── Report title box (right side) ────────────────────────
    const boxW = Math.min(80, pw * 0.4);
    const boxX = pw - mr - boxW;
    const boxY = 10;

    doc.setFillColor(...BLUE);
    doc.roundedRect(boxX, boxY, boxW, 8, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...WHITE);
    doc.text(title, boxX + boxW / 2, boxY + 5.8, { align: "center" });

    // Subtitle under box
    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text(subtitle, boxX + boxW / 2, boxY + 14, { align: "center" });
    }

    y = Math.max(y, boxY + (subtitle ? 20 : 12)) + 4;

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(ml, y, pw - mr, y);
    y += 4;
  } else {
    // ── Fallback: simple centered header (legacy behavior) ───
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(companyName || "Company", pw / 2, 15, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(title, pw / 2, 23, { align: "center" });

    if (subtitle) {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(subtitle, pw / 2, 30, { align: "center" });
      doc.setTextColor(0, 0, 0);
    }

    y = subtitle ? 36 : 30;
  }

  sheets.forEach((sheet, idx) => {
    if (idx > 0) {
      doc.addPage();
      y = 15;
    }

    // Sheet title (only if multiple sheets)
    if (sheets.length > 1) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(sheet.name, ml, y);
      y += 6;
    }

    autoTable(doc, {
      head: [sheet.headers],
      body: sheet.rows,
      startY: y,
      theme: "grid",
      headStyles: {
        fillColor: BLUE,
        textColor: 255,
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 7.5 },
      styles: { cellPadding: 2, overflow: "linebreak" },
      margin: { left: ml, right: mr },
    });
  });

  // Page numbers on all pages
  const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY_TEXT);
    doc.text(`Page ${i} / ${totalPages}`, pw / 2, ph - 8, { align: "center" });
  }

  return doc;
}

// ── PDF Export (save to disk) ───────────────────────────────────
export function exportToPDF(config: PDFConfig) {
  const doc = buildPDFDocument(config);
  const { fileName } = config;
  doc.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}

// ── PDF as Base64 string (for email attachments) ───────────────
// Returns the raw base64 string (no data-URI prefix).
export function generatePDFBase64(config: Omit<PDFConfig, "fileName">): string {
  const doc = buildPDFDocument(config);
  const dataUri = doc.output("datauristring") as string;
  // Strip "data:application/pdf;base64," prefix
  return dataUri.split(",")[1];
}

// ── Formatting Helpers ─────────────────────────────────────────
export function fmtNum(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(n);
}

export function fmtDateExport(s: string): string {
  if (!s) return "";
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return s;
  }
}

// Month names for filenames
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function monthLabel(monthIndex: number, year: number): string {
  return `${MONTH_SHORT[monthIndex]}-${year}`;
}
