import { utils, writeFileXLSX } from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ── Types ──────────────────────────────────────────────────────
interface SheetConfig {
  name: string;
  headers: string[];
  rows: (string | number)[][];
}

interface ExcelConfig {
  fileName: string;
  sheets: SheetConfig[];
}

interface PDFConfig {
  fileName: string;
  title: string;
  subtitle?: string;
  companyName?: string;
  orientation?: "portrait" | "landscape";
  sheets: SheetConfig[];
}

// ── Excel Export ───────────────────────────────────────────────
export function exportToExcel({ fileName, sheets }: ExcelConfig) {
  const workbook = utils.book_new();

  for (const sheet of sheets) {
    const data = [sheet.headers, ...sheet.rows];
    const worksheet = utils.aoa_to_sheet(data);

    // Auto-size columns
    worksheet["!cols"] = sheet.headers.map((h, i) => ({
      wch: Math.max(
        h.length,
        ...sheet.rows.map((r) => String(r[i] ?? "").length)
      ) + 2,
    }));

    utils.book_append_sheet(workbook, worksheet, sheet.name.substring(0, 31));
  }

  writeFileXLSX(workbook, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}

// ── PDF Export ─────────────────────────────────────────────────
export function exportToPDF({
  fileName,
  title,
  subtitle,
  companyName,
  orientation = "portrait",
  sheets,
}: PDFConfig) {
  const doc = new jsPDF({ orientation });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Company header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(companyName || "Company", pageWidth / 2, 15, { align: "center" });

  // Report title
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(title, pageWidth / 2, 23, { align: "center" });

  // Subtitle (date range, etc.)
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, pageWidth / 2, 30, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }

  let startY = subtitle ? 36 : 30;

  sheets.forEach((sheet, idx) => {
    if (idx > 0) {
      doc.addPage();
      startY = 15;
    }

    // Sheet title (only if multiple sheets)
    if (sheets.length > 1) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(sheet.name, 14, startY);
      startY += 6;
    }

    autoTable(doc, {
      head: [sheet.headers],
      body: sheet.rows,
      startY,
      theme: "grid",
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 7.5 },
      styles: { cellPadding: 2, overflow: "linebreak" },
      margin: { left: 10, right: 10 },
    });
  });

  doc.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}

// ── Formatting Helpers ─────────────────────────────────────────
export function fmtNum(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
