import { getStateFromGSTIN } from "./gst-state-codes";

export const DEV_COMPANY_GSTIN = "27AABCT1234F1Z5";

export function getCompanyStateCode(): string {
  return DEV_COMPANY_GSTIN.substring(0, 2);
}

export function classifyInvoice(
  customerGstin: string | null,
  totalAmount: number
): "B2B" | "B2C_LARGE" | "B2C_SMALL" {
  if (customerGstin) return "B2B";
  if (totalAmount > 250000) return "B2C_LARGE";
  return "B2C_SMALL";
}

export function splitTax(taxAmount: number): { cgst: number; sgst: number } {
  const half = taxAmount / 2;
  return { cgst: half, sgst: half };
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
  return {
    startDate: new Date(startYear, 3, 1), // April 1
    endDate: new Date(startYear + 1, 2, 31, 23, 59, 59, 999), // March 31
  };
}

export function getMonthDates(
  month: number,
  year: number
): { startDate: Date; endDate: Date } {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999); // last day of month
  return { startDate, endDate };
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function getMonthName(month: number): string {
  return MONTH_NAMES[month - 1] || "";
}
