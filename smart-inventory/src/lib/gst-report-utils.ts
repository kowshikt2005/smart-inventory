import { getStateFromGSTIN, getStateCodeFromName } from "./gst-state-codes";

// ─── UQC Mapping ──────────────────────────────────────────────────────────────
// Maps app unit strings → GST portal UQC codes
const UQC_MAP: Record<string, string> = {
  PCS: "NOS", NOS: "NOS", KG: "KGS", KGS: "KGS", G: "GMS", GMS: "GMS",
  L: "LTR", LTR: "LTR", ML: "MLT", MLT: "MLT", M: "MTR", MTR: "MTR",
  BOX: "BOX", CTN: "CTN", DZN: "DZN", PAK: "PAK", PKT: "PAK",
  SET: "SET", ROL: "ROL", BAG: "BAG", TBS: "TBS", BTL: "BTL",
  CAN: "CAN", TIN: "TIN", PRS: "PRS", SQM: "SQM", SQF: "SQF",
};

export function toUQC(unit: string | null | undefined): string {
  if (!unit) return "OTH";
  return UQC_MAP[unit.trim().toUpperCase()] ?? "OTH";
}

// ─── Rounding ─────────────────────────────────────────────────────────────────
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── IGST / CGST+SGST Split ──────────────────────────────────────────────────
/**
 * Split tax into IGST or CGST+SGST based on state codes.
 * Same state → intra-state → CGST + SGST (50/50)
 * Different state → inter-state → IGST only
 */
export function splitGST(
  taxAmount: number,
  companyStateCode: string,
  counterpartyStateCode: string | null
): { igst: number; cgst: number; sgst: number } {
  const total = round2(taxAmount);
  if (!counterpartyStateCode || counterpartyStateCode === companyStateCode) {
    const half = round2(total / 2);
    return { igst: 0, cgst: half, sgst: round2(total - half) };
  }
  return { igst: total, cgst: 0, sgst: 0 };
}

/**
 * Determine supply type for B2CS section.
 */
export function getSupplyType(
  companyStateCode: string,
  counterpartyStateCode: string | null
): "INTRA" | "INTER" {
  if (!counterpartyStateCode || counterpartyStateCode === companyStateCode) return "INTRA";
  return "INTER";
}

/**
 * Extract 2-digit state code from GSTIN or state name.
 * Priority: GSTIN first 2 digits → state name lookup → null
 */
export function getStateCode(
  gstin: string | null | undefined,
  stateName: string | null | undefined
): string | null {
  if (gstin && gstin.length >= 2) {
    const code = gstin.substring(0, 2);
    if (/^\d{2}$/.test(code)) return code;
  }
  return getStateCodeFromName(stateName);
}

// ─── Date Formatting ──────────────────────────────────────────────────────────
/** Format Date to DD-MM-YYYY (government portal format) */
export function fmtGovDate(d: Date | string): string {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [yyyy, mm, dd] = d.split("-");
    return `${dd}-${mm}-${yyyy}`;
  }

  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return String(d);

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(dt);

  const dd = parts.find((p) => p.type === "day")?.value || "01";
  const mm = parts.find((p) => p.type === "month")?.value || "01";
  const yyyy = parts.find((p) => p.type === "year")?.value || "1970";
  return `${dd}-${mm}-${yyyy}`;
}

/** Format filing period as MMYYYY */
export function fmtFilingPeriod(month: number, year: number): string {
  return String(month).padStart(2, "0") + String(year);
}

// ─── Kept for backward compat (GSTR-2, GSTR-9 routes) ────────────────────────
export function splitTax(taxAmount: number): { cgst: number; sgst: number } {
  const half = round2(taxAmount / 2);
  return { cgst: half, sgst: round2(taxAmount - half) };
}

export function classifyInvoice(
  customerGstin: string | null,
  totalAmount: number
): "B2B" | "B2C_LARGE" | "B2C_SMALL" {
  if (customerGstin) return "B2B";
  if (totalAmount > 250000) return "B2C_LARGE";
  return "B2C_SMALL";
}

export function getPlaceOfSupply(
  gstin: string | null,
  state: string | null
): string {
  if (gstin) {
    const info = getStateFromGSTIN(gstin);
    if (info) return `${info.stateCode}-${info.stateName}`;
  }
  return state || "Unknown";
}

export function getFYDates(fy: string): { startDate: Date; endDate: Date } {
  const [startYear] = fy.split("-").map(Number);

  // Report boundaries are based on IST (Indian financial year), converted to UTC instants.
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const startIstMs = Date.UTC(startYear, 3, 1, 0, 0, 0, 0);
  const endIstMs = Date.UTC(startYear + 1, 2, 31, 23, 59, 59, 999);

  return {
    startDate: new Date(startIstMs - istOffsetMs),
    endDate: new Date(endIstMs - istOffsetMs),
  };
}

export function getMonthDates(
  month: number,
  year: number
): { startDate: Date; endDate: Date } {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const monthStartIstMs = Date.UTC(year, month - 1, 1, 0, 0, 0, 0);
  const monthEndDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthEndIstMs = Date.UTC(year, month - 1, monthEndDay, 23, 59, 59, 999);

  return {
    startDate: new Date(monthStartIstMs - istOffsetMs),
    endDate: new Date(monthEndIstMs - istOffsetMs),
  };
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function getMonthName(month: number): string {
  return MONTH_NAMES[month - 1] || "";
}
