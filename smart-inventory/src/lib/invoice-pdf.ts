import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getStateCode, splitGST } from "./gst-report-utils";

// ── Types ────────────────────────────────────────────────────────
export interface CompanySettings {
  company_name: string;
  company_address: string;
  company_city: string;
  company_state: string;
  company_pincode: string;
  company_phone: string;
  company_email: string;
  company_gstin: string;
  company_pan: string;
  company_msme: string;
  company_fssai: string;
}

export interface BankAccountInfo {
  accountName: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string | null;
  branch: string | null;
}

export interface InvoiceCustomer {
  name: string;
  gstin: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

export interface InvoiceItemData {
  quantity: number;
  rate: number;
  taxRate: number;
  taxAmount: number;
  amount: number;
  item: {
    name: string;
    hsnCode: string | null;
    unit: string;
    sellingPrice: number;
    mrp: number;
  };
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  subtotal: number;
  cgst: number;
  sgst: number;
  taxAmount: number;
  roundOff: number;
  totalAmount: number;
  customer: InvoiceCustomer;
  items: InvoiceItemData[];
}

// ── Number to words (Indian English) ─────────────────────────────
const ones = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const tens = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function twoDigitWords(n: number): string {
  if (n < 20) return ones[n];
  return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
}

export function numberToWords(num: number): string {
  if (num === 0) return "Zero";

  const n = Math.floor(Math.abs(num));
  if (n === 0) return "Zero";

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = Math.floor((n % 1000) / 100);
  const remainder = n % 100;

  const parts: string[] = [];
  if (crore) parts.push(twoDigitWords(crore) + " Crore");
  if (lakh) parts.push(twoDigitWords(lakh) + " Lakh");
  if (thousand) parts.push(twoDigitWords(thousand) + " Thousand");
  if (hundred) parts.push(ones[hundred] + " Hundred");
  if (remainder) parts.push(twoDigitWords(remainder));

  return parts.join(" ");
}

function amountToWordsINR(amount: number): string {
  const absolute = Math.abs(amount);
  let rupees = Math.floor(absolute);
  let paise = Math.round((absolute - rupees) * 100);

  if (paise === 100) {
    rupees += 1;
    paise = 0;
  }

  const signPrefix = amount < 0 ? "Minus " : "";
  const rupeesWords = numberToWords(rupees);

  if (paise === 0) {
    return `${signPrefix}Rupees ${rupeesWords} only`;
  }

  return `${signPrefix}Rupees ${rupeesWords} and ${numberToWords(paise)} Paise only`;
}

function extractPanFromGSTIN(gstin: string | null): string | null {
  if (!gstin) return null;
  const normalized = gstin.trim().toUpperCase();
  if (!/^[0-9A-Z]{15}$/.test(normalized)) return null;
  return normalized.slice(2, 12);
}

// ── Formatting helpers ───────────────────────────────────────────
function fmtINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(s: string): string {
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    const dd = d.getDate().toString().padStart(2, "0");
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  } catch {
    return s;
  }
}

// ── PDF colors ───────────────────────────────────────────────────
const BLUE: [number, number, number] = [37, 99, 175];
const WHITE: [number, number, number] = [255, 255, 255];
const GRAY_TEXT: [number, number, number] = [100, 100, 100];

// ── Main generator ───────────────────────────────────────────────
export function generateInvoicePDF(
  invoice: InvoiceData,
  company: CompanySettings,
  bankAccount: BankAccountInfo | null
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth(); // ~210
  const ph = doc.internal.pageSize.getHeight(); // ~297
  const ml = 12; // margin left
  const mr = 12; // margin right
  const cw = pw - ml - mr; // content width

  let y = 12;

  // ── COMPANY HEADER (left) + TAX INVOICE BOX (right) ────────────
  // Company name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(company.company_name || "Company Name", ml, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_TEXT);

  const companyLines: string[] = [];
  if (company.company_address) companyLines.push(company.company_address);
  const cityLine = [company.company_city, company.company_state, company.company_pincode]
    .filter(Boolean)
    .join(", ");
  if (cityLine) companyLines.push(cityLine);
  if (company.company_phone) companyLines.push("Phone: " + company.company_phone);
  if (company.company_email) companyLines.push("Email: " + company.company_email);
  if (company.company_gstin) companyLines.push("GSTIN: " + company.company_gstin);
  if (company.company_pan) companyLines.push("PAN: " + company.company_pan);
  if (company.company_msme) companyLines.push("MSME/Udyam: " + company.company_msme);
  if (company.company_fssai) companyLines.push("FSSAI: " + company.company_fssai);

  for (const line of companyLines) {
    doc.text(line, ml, y);
    y += 3.5;
  }

  // Tax Invoice box (right side)
  const boxW = 65;
  const boxX = pw - mr - boxW;
  const boxY = 10;

  doc.setFillColor(...BLUE);
  doc.roundedRect(boxX, boxY, boxW, 8, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text("Tax Invoice", boxX + boxW / 2, boxY + 5.8, { align: "center" });

  // Invoice details right-aligned
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  let ry = boxY + 13;
  const labelX = boxX + 2;
  const valueX = boxX + boxW - 2;

  doc.setFont("helvetica", "bold");
  doc.text("Invoice No:", labelX, ry);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.invoiceNumber, valueX, ry, { align: "right" });
  ry += 4;

  doc.setFont("helvetica", "bold");
  doc.text("Date:", labelX, ry);
  doc.setFont("helvetica", "normal");
  doc.text(fmtDate(invoice.invoiceDate), valueX, ry, { align: "right" });
  ry += 4;

  if (invoice.dueDate) {
    doc.setFont("helvetica", "bold");
    doc.text("Due Date:", labelX, ry);
    doc.setFont("helvetica", "normal");
    doc.text(fmtDate(invoice.dueDate), valueX, ry, { align: "right" });
    ry += 4;
  }

  // Move y past both columns
  y = Math.max(y, ry) + 4;

  // ── Horizontal divider ─────────────────────────────────────────
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(ml, y, pw - mr, y);
  y += 4;

  // ── CUSTOMER SECTION ───────────────────────────────────────────
  const colMid = ml + cw / 2;

  // Left: Issued to
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BLUE);
  doc.text("Issued to", ml, y);

  // Right: Billing & Shipping Address
  doc.text("Billing & Shipping Address", colMid + 4, y);
  y += 4;

  doc.setTextColor(0, 0, 0);

  // Customer name (bold)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(invoice.customer.name, ml, y);

  doc.text(invoice.customer.name, colMid + 4, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_TEXT);

  // Left column: GSTIN, PAN (derived), POS
  let ly = y;
  if (invoice.customer.gstin) {
    const normalizedGstin = invoice.customer.gstin.trim().toUpperCase();
    doc.text("GSTIN: " + normalizedGstin, ml, ly);
    ly += 3.5;

    const pan = extractPanFromGSTIN(normalizedGstin);
    if (pan) {
      doc.text("PAN: " + pan, ml, ly);
      ly += 3.5;
    }
  }
  if (invoice.customer.state) {
    doc.text("POS: " + invoice.customer.state, ml, ly);
    ly += 3.5;
  }

  // Right column: Address
  let ryAddr = y;
  if (invoice.customer.address) {
    doc.text(invoice.customer.address, colMid + 4, ryAddr);
    ryAddr += 3.5;
  }
  const custCityLine = [invoice.customer.city, invoice.customer.state, invoice.customer.pincode]
    .filter(Boolean)
    .join(", ");
  if (custCityLine) {
    doc.text(custCityLine, colMid + 4, ryAddr);
    ryAddr += 3.5;
  }

  y = Math.max(ly, ryAddr) + 4;

  // ── ITEMS TABLE ────────────────────────────────────────────────
  const tableHeaders = [
    "SNo",
    "Item Description",
    "HSN/SAC",
    "Qty",
    "Units",
    "Rate",
    "Gross Amt",
    "MRP",
    "Tax %",
    "Amount (INR)",
  ];

  const tableRows = invoice.items.map((item, idx) => {
    const grossAmt = Number(item.quantity) * Number(item.rate);
    const totalAmt = grossAmt + Number(item.taxAmount);
    return [
      String(idx + 1),
      item.item.name,
      item.item.hsnCode || "-",
      String(Number(item.quantity)),
      item.item.unit,
      fmtINR(Number(item.rate)),
      fmtINR(grossAmt),
      fmtINR(Number(item.item.mrp || item.item.sellingPrice)),
      Number(item.taxRate) + "%",
      fmtINR(totalAmt),
    ];
  });

  // Sub Total row
  const subTotalGross = invoice.items.reduce(
    (s, i) => s + Number(i.quantity) * Number(i.rate),
    0
  );

  autoTable(doc, {
    startY: y,
    head: [tableHeaders],
    body: tableRows,
    foot: [
      [
        "",
        "",
        "",
        "",
        "",
        "",
        "Sub Total",
        "",
        "",
        fmtINR(subTotalGross + Number(invoice.taxAmount)),
      ],
    ],
    theme: "grid",
    headStyles: {
      fillColor: BLUE,
      textColor: 255,
      fontSize: 7,
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: { fontSize: 7, cellPadding: 1.5 },
    footStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 7,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { cellWidth: "auto" },
      2: { halign: "center", cellWidth: 16 },
      3: { halign: "right", cellWidth: 12 },
      4: { halign: "center", cellWidth: 14 },
      5: { halign: "right", cellWidth: 18 },
      6: { halign: "right", cellWidth: 20 },
      7: { halign: "right", cellWidth: 18 },
      8: { halign: "center", cellWidth: 14 },
      9: { halign: "right", cellWidth: 24 },
    },
    margin: { left: ml, right: mr },
    didDrawPage: () => {
      // Page footer
      const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(...GRAY_TEXT);
      doc.text(
        `Page ${doc.getCurrentPageInfo().pageNumber} / ${pageCount}`,
        pw / 2,
        ph - 8,
        { align: "center" }
      );
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // ── Check if we need a new page for footer content ─────────────
  if (y > ph - 80) {
    doc.addPage();
    y = 15;
  }

  // ── FOOTER: Amount in words + Bank details (left) + Tax summary (right) ──
  const footerLeftW = cw * 0.55;
  const footerRightX = ml + footerLeftW + 4;
  const footerStartY = y;

  // ─── Left side ─────────────────────────────────────────────────
  // Amount in words
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text("Amount in Words:", ml, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const words = amountToWordsINR(Number(invoice.totalAmount));
  const wordLines = doc.splitTextToSize(words, footerLeftW);
  doc.text(wordLines, ml, y);
  y += wordLines.length * 3.5 + 4;

  // Bank details
  if (bankAccount) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...BLUE);
    doc.text("Bank Details", ml, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY_TEXT);

    const bankLines = [
      ["Account Name", bankAccount.accountName],
      ["Account No", bankAccount.accountNumber],
      ["Bank", bankAccount.bankName],
      ...(bankAccount.ifscCode ? [["IFSC Code", bankAccount.ifscCode]] : []),
      ...(bankAccount.branch ? [["Branch", bankAccount.branch]] : []),
    ];

    for (const [label, value] of bankLines) {
      doc.setFont("helvetica", "bold");
      doc.text(label + ":", ml, y);
      doc.setFont("helvetica", "normal");
      doc.text(value, ml + 28, y);
      y += 3.5;
    }
  }

  // ─── Right side: Tax breakdown ─────────────────────────────────
  let ry2 = footerStartY;
  const taxRightEdge = pw - mr;

  // Group items by tax rate and split tax based on intra/inter-state rules.
  const companyStateCode = getStateCode(company.company_gstin, company.company_state);
  const customerStateCode = getStateCode(invoice.customer.gstin, invoice.customer.state);
  const effectiveCompanyStateCode = companyStateCode ?? "";

  const taxGroups: Record<number, { taxable: number; igst: number; cgst: number; sgst: number }> = {};
  for (const item of invoice.items) {
    const rate = Number(item.taxRate);
    if (!taxGroups[rate]) taxGroups[rate] = { taxable: 0, igst: 0, cgst: 0, sgst: 0 };
    const taxable = Number(item.quantity) * Number(item.rate);
    const tax = Number(item.taxAmount);
    const split = splitGST(tax, effectiveCompanyStateCode, customerStateCode);
    taxGroups[rate].taxable += taxable;
    taxGroups[rate].igst += split.igst;
    taxGroups[rate].cgst += split.cgst;
    taxGroups[rate].sgst += split.sgst;
  }

  doc.setFontSize(7.5);

  for (const [rate, group] of Object.entries(taxGroups)) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY_TEXT);

    const halfRate = (Number(rate) / 2).toFixed(1);

    if (group.igst > 0) {
      doc.text(`IGST @ ${Number(rate).toFixed(1)}%`, footerRightX, ry2);
      doc.text(fmtINR(group.igst), taxRightEdge, ry2, { align: "right" });
      ry2 += 3.5;
    } else {
      doc.text(`CGST @ ${halfRate}%`, footerRightX, ry2);
      doc.text(fmtINR(group.cgst), taxRightEdge, ry2, { align: "right" });
      ry2 += 3.5;

      doc.text(`SGST @ ${halfRate}%`, footerRightX, ry2);
      doc.text(fmtINR(group.sgst), taxRightEdge, ry2, { align: "right" });
      ry2 += 3.5;
    }
  }

  if (Number(invoice.roundOff) !== 0) {
    doc.text("Round Off", footerRightX, ry2);
    doc.text(fmtINR(Number(invoice.roundOff)), taxRightEdge, ry2, { align: "right" });
    ry2 += 3.5;
  }

  ry2 += 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(footerRightX, ry2, taxRightEdge, ry2);
  ry2 += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("TOTAL", footerRightX, ry2);
  doc.text("Rs. " + fmtINR(Number(invoice.totalAmount)), taxRightEdge, ry2, {
    align: "right",
  });
  ry2 += 5;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(...GRAY_TEXT);
  doc.text("E & O.E", taxRightEdge, ry2, { align: "right" });

  // Move y past both columns
  y = Math.max(y, ry2) + 10;

  // ── Check for new page before signatures ───────────────────────
  if (y > ph - 35) {
    doc.addPage();
    y = 15;
  }

  // ── SIGNATURE SECTION ──────────────────────────────────────────
  // "For COMPANY NAME" on right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text("For " + (company.company_name || ""), taxRightEdge, y, { align: "right" });
  y += 18;

  // Signature lines
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.2);

  // Left: Customer Signature
  doc.line(ml, y, ml + 50, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GRAY_TEXT);
  doc.text("Customer Signature", ml + 25, y + 4, { align: "center" });

  // Right: Authorized Signature
  doc.line(taxRightEdge - 50, y, taxRightEdge, y);
  doc.text("Authorized Signature", taxRightEdge - 25, y + 4, { align: "center" });

  // ── Page number footer on all pages ────────────────────────────
  const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY_TEXT);
    doc.text(`Page ${i} / ${totalPages}`, pw / 2, ph - 8, { align: "center" });
  }

  // ── Save ───────────────────────────────────────────────────────
  doc.save(`${invoice.invoiceNumber}.pdf`);
}
