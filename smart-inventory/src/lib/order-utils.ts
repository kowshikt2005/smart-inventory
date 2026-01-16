import { PrismaClient } from '@/generated/prisma';
import type { Decimal } from '@prisma/client/runtime/library';

// System user ID for operations before auth is implemented
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Generate the next order number in sequence (SO-0001, SO-0002, etc.)
 */
export async function generateOrderNumber(db: PrismaClient): Promise<string> {
  const lastOrder = await db.salesOrder.findFirst({
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  });

  let nextNum = 1;
  if (lastOrder) {
    const match = lastOrder.orderNumber.match(/SO-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `SO-${String(nextNum).padStart(4, '0')}`;
}

/**
 * Calculate tax amount based on taxable amount and rate
 */
export function calculateTax(amount: number, taxRate: number): { taxAmount: number; cgst: number; sgst: number } {
  const taxAmount = amount * (taxRate / 100);
  const cgst = taxAmount / 2;
  const sgst = taxAmount / 2;

  return {
    taxAmount: Math.round(taxAmount * 100) / 100,
    cgst: Math.round(cgst * 100) / 100,
    sgst: Math.round(sgst * 100) / 100,
  };
}

/**
 * Calculate line item totals
 */
export function calculateLineItem(
  quantity: number,
  rate: number,
  taxRate: number,
  discountPercent: number = 0
): {
  amount: number;
  taxAmount: number;
  totalAmount: number;
} {
  const grossAmount = quantity * rate;
  const discountAmount = grossAmount * (discountPercent / 100);
  const amount = grossAmount - discountAmount;
  const { taxAmount } = calculateTax(amount, taxRate);
  const totalAmount = amount + taxAmount;

  return {
    amount: Math.round(amount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

/**
 * Calculate order totals from line items
 */
export function calculateOrderTotals(
  items: Array<{ amount: number; taxAmount: number }>,
  roundOff: number = 0
): {
  subtotal: number;
  totalTax: number;
  cgst: number;
  sgst: number;
  totalAmount: number;
} {
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const totalTax = items.reduce((sum, item) => sum + item.taxAmount, 0);
  const cgst = totalTax / 2;
  const sgst = totalTax / 2;
  const totalAmount = subtotal + totalTax + roundOff;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    cgst: Math.round(cgst * 100) / 100,
    sgst: Math.round(sgst * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

/**
 * Get effective rate considering customer rate sheet
 */
export function getEffectiveRate(
  standardPrice: number,
  rateSheet?: {
    isActive: boolean;
    itemRatePercent: number | Decimal;
    discountPercent: number | Decimal;
  } | null
): number {
  if (!rateSheet || !rateSheet.isActive) {
    return standardPrice;
  }

  const itemRatePercent = Number(rateSheet.itemRatePercent);
  const discountPercent = Number(rateSheet.discountPercent);

  // Apply item rate percent first, then discount
  const rateAfterPercent = standardPrice * (itemRatePercent / 100);
  const effectiveRate = rateAfterPercent * (1 - discountPercent / 100);

  return Math.round(effectiveRate * 100) / 100;
}

/**
 * Status transition validation
 * New simplified workflow: OPEN <-> HOLD -> REJECTED
 */
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['HOLD', 'REJECTED'],
  HOLD: ['OPEN', 'REJECTED'],
  REJECTED: [], // Terminal state
};

export function isValidStatusTransition(fromStatus: string, toStatus: string): boolean {
  const allowedTransitions = STATUS_TRANSITIONS[fromStatus];
  return allowedTransitions ? allowedTransitions.includes(toStatus) : false;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
