import { PrismaClient } from '@/generated/prisma';

// System user ID for operations before auth is implemented
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Generate the next purchase order number in sequence (PO-0001, PO-0002, etc.)
 */
export async function generatePurchaseOrderNumber(db: PrismaClient): Promise<string> {
  const lastOrder = await db.purchaseOrder.findFirst({
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  });

  let nextNum = 1;
  if (lastOrder) {
    const match = lastOrder.orderNumber.match(/PO-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `PO-${String(nextNum).padStart(4, '0')}`;
}

/**
 * Generate the next purchase invoice number in sequence (PI-0001, PI-0002, etc.)
 */
export async function generatePurchaseInvoiceNumber(db: PrismaClient): Promise<string> {
  const lastInvoice = await db.purchaseInvoice.findFirst({
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });

  let nextNum = 1;
  if (lastInvoice) {
    const match = lastInvoice.invoiceNumber.match(/PI-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `PI-${String(nextNum).padStart(4, '0')}`;
}

/**
 * Generate the next vendor payment number in sequence (VP-0001, VP-0002, etc.)
 */
export async function generateVendorPaymentNumber(db: PrismaClient): Promise<string> {
  const lastPayment = await db.vendorPayment.findFirst({
    orderBy: { paymentNumber: 'desc' },
    select: { paymentNumber: true },
  });

  let nextNum = 1;
  if (lastPayment) {
    const match = lastPayment.paymentNumber.match(/VP-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `VP-${String(nextNum).padStart(4, '0')}`;
}

/**
 * Generate the next purchase return number in sequence (PR-0001, PR-0002, etc.)
 */
export async function generatePurchaseReturnNumber(db: PrismaClient): Promise<string> {
  const lastReturn = await db.purchaseReturn.findFirst({
    orderBy: { returnNumber: 'desc' },
    select: { returnNumber: true },
  });

  let nextNum = 1;
  if (lastReturn) {
    const match = lastReturn.returnNumber.match(/PR-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `PR-${String(nextNum).padStart(4, '0')}`;
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
 * Calculate line item totals for purchase documents
 */
export function calculatePurchaseLineItem(
  quantity: number,
  rate: number,
  taxRate: number
): {
  amount: number;
  taxAmount: number;
  totalAmount: number;
} {
  const amount = quantity * rate;
  const { taxAmount } = calculateTax(amount, taxRate);
  const totalAmount = amount + taxAmount;

  return {
    amount: Math.round(amount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

/**
 * Calculate purchase document totals from line items
 */
export function calculatePurchaseTotals(
  items: Array<{ amount: number; taxAmount: number }>
): {
  subtotal: number;
  totalTax: number;
  totalAmount: number;
} {
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const totalTax = items.reduce((sum, item) => sum + item.taxAmount, 0);
  const totalAmount = subtotal + totalTax;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

/**
 * Purchase Order status transition validation
 * OPEN -> PARTIAL -> RECEIVED
 * OPEN -> CANCELLED
 * PARTIAL -> CANCELLED (optional)
 */
export const PO_STATUS_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['PARTIAL', 'RECEIVED', 'CANCELLED'],
  PARTIAL: ['RECEIVED', 'CANCELLED'],
  RECEIVED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

export function isValidPOStatusTransition(fromStatus: string, toStatus: string): boolean {
  const allowedTransitions = PO_STATUS_TRANSITIONS[fromStatus];
  return allowedTransitions ? allowedTransitions.includes(toStatus) : false;
}

/**
 * Purchase Invoice status transition validation
 * PENDING -> PAID
 * PENDING -> OVERDUE (automatic based on due date)
 * PENDING -> CANCELLED
 * OVERDUE -> PAID
 * OVERDUE -> CANCELLED
 */
export const PI_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PAID', 'OVERDUE', 'CANCELLED'],
  OVERDUE: ['PAID', 'CANCELLED'],
  PAID: [], // Terminal state
  CANCELLED: [], // Terminal state
};

export function isValidPIStatusTransition(fromStatus: string, toStatus: string): boolean {
  const allowedTransitions = PI_STATUS_TRANSITIONS[fromStatus];
  return allowedTransitions ? allowedTransitions.includes(toStatus) : false;
}

/**
 * Purchase Return status transition validation
 * OPEN -> COMPLETED
 * OPEN -> CANCELLED
 */
export const PR_STATUS_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

export function isValidPRStatusTransition(fromStatus: string, toStatus: string): boolean {
  const allowedTransitions = PR_STATUS_TRANSITIONS[fromStatus];
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
