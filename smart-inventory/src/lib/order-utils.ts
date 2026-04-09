import { PrismaClient } from '@/generated/prisma';
import type { Decimal } from '@prisma/client/runtime/library';

// System user ID for operations before auth is implemented
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Generate the next order number in sequence (SO-0001, SO-0002, etc.)
 * Checks both SalesOrder table AND Invoice table (which stores orderNumber from deleted orders)
 */
export async function generateOrderNumber(db: PrismaClient): Promise<string> {
  // Check both tables to find the highest SO number ever used
  const [lastSalesOrder, lastInvoice] = await Promise.all([
    db.salesOrder.findFirst({
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    }),
    db.invoice.findFirst({
      where: { orderNumber: { startsWith: 'SO-' } },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    }),
  ]);

  let maxNum = 0;

  // Extract number from sales order
  if (lastSalesOrder) {
    const match = lastSalesOrder.orderNumber.match(/SO-(\d+)/);
    if (match) {
      maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
  }

  // Extract number from invoice (deleted orders end up here)
  if (lastInvoice?.orderNumber) {
    const match = lastInvoice.orderNumber.match(/SO-(\d+)/);
    if (match) {
      maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
  }

  return `SO-${String(maxNum + 1).padStart(4, '0')}`;
}

/**
 * Calculate tax amount from tax-inclusive amount (back-calculation)
 * For tax-inclusive pricing: inclusiveAmount = baseAmount + tax
 * So: baseAmount = inclusiveAmount / (1 + taxRate/100)
 * And: taxAmount = inclusiveAmount - baseAmount
 */
export function calculateTaxInclusive(inclusiveAmount: number, taxRate: number): {
  baseAmount: number;
  taxAmount: number;
  cgst: number;
  sgst: number
} {
  const baseAmount = inclusiveAmount / (1 + taxRate / 100);
  const taxAmount = inclusiveAmount - baseAmount;
  const cgst = taxAmount / 2;
  const sgst = taxAmount / 2;

  return {
    baseAmount: Math.round(baseAmount * 1000) / 1000,
    taxAmount: Math.round(taxAmount * 1000) / 1000,
    cgst: Math.round(cgst * 1000) / 1000,
    sgst: Math.round(sgst * 1000) / 1000,
  };
}

/**
 * Calculate tax amount based on taxable amount and rate (tax exclusive - kept for backward compatibility)
 */
export function calculateTax(amount: number, taxRate: number): { taxAmount: number; cgst: number; sgst: number } {
  const taxAmount = amount * (taxRate / 100);
  const cgst = taxAmount / 2;
  const sgst = taxAmount / 2;

  return {
    taxAmount: Math.round(taxAmount * 1000) / 1000,
    cgst: Math.round(cgst * 1000) / 1000,
    sgst: Math.round(sgst * 1000) / 1000,
  };
}

/**
 * Calculate line item totals (Tax Inclusive System)
 * Rate is the tax-inclusive price (MRP). We back-calculate the base amount and tax.
 */
export function calculateLineItem(
  quantity: number,
  rate: number,
  taxRate: number,
  discountPercent: number = 0
): {
  amount: number;      // Base amount (excluding tax)
  taxAmount: number;   // Tax amount
  totalAmount: number; // Total (amount + tax) = quantity * rate after discount
} {
  // Rate is tax-inclusive, so total line value is simply quantity * rate
  const grossTotal = quantity * rate;
  const discountAmount = grossTotal * (discountPercent / 100);
  const totalAmount = grossTotal - discountAmount;

  // Back-calculate base amount and tax from the inclusive total
  const { baseAmount, taxAmount } = calculateTaxInclusive(totalAmount, taxRate);

  return {
    amount: baseAmount,  // Base amount (taxable value)
    taxAmount: taxAmount,
    totalAmount: Math.round(totalAmount * 1000) / 1000,
  };
}

/**
 * Calculate line item totals with automatic GST model detection
 * - If discountPercent > 0: Rate is MRP (tax-inclusive), use inclusive calculation
 * - If discountPercent == 0: Rate is selling price (tax-exclusive), use exclusive calculation
 *
 * This matches the pricing logic:
 * - No rate sheet → selling price + EXCLUSIVE GST
 * - Rate sheet with 0% discount → selling price + EXCLUSIVE GST
 * - Rate sheet with discount > 0 → MRP + INCLUSIVE GST
 */
export function calculateLineItemV2(
  quantity: number,
  rate: number,
  taxRate: number,
  discountPercent: number = 0
): {
  amount: number;      // Base amount (excluding tax)
  taxAmount: number;   // Tax amount
  totalAmount: number; // Total (amount + tax)
  isGstInclusive: boolean;
} {
  const isGstInclusive = discountPercent > 0;

  if (isGstInclusive) {
    // MRP-based pricing with discount: Rate includes GST, back-calculate
    const grossTotal = quantity * rate;
    const { baseAmount, taxAmount } = calculateTaxInclusive(grossTotal, taxRate);

    return {
      amount: baseAmount,
      taxAmount: taxAmount,
      totalAmount: Math.round(grossTotal * 1000) / 1000,
      isGstInclusive: true,
    };
  } else {
    // Selling price: Rate is exclusive, add GST on top
    const baseAmount = quantity * rate;
    const { taxAmount } = calculateTax(baseAmount, taxRate);
    const totalAmount = baseAmount + taxAmount;

    return {
      amount: Math.round(baseAmount * 1000) / 1000,
      taxAmount: taxAmount,
      totalAmount: Math.round(totalAmount * 1000) / 1000,
      isGstInclusive: false,
    };
  }
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
    subtotal: Math.round(subtotal * 1000) / 1000,
    totalTax: Math.round(totalTax * 1000) / 1000,
    cgst: Math.round(cgst * 1000) / 1000,
    sgst: Math.round(sgst * 1000) / 1000,
    totalAmount: Math.round(totalAmount * 1000) / 1000,
  };
}

/**
 * Inclusion discounts structure
 */
interface InclusionDiscount {
  id: string;
  discountPercent: number;
}

interface InclusionDiscounts {
  brands?: InclusionDiscount[];
  subBrands?: InclusionDiscount[];
  items?: InclusionDiscount[];
}

/**
 * Resolve discount from inclusion model using cascade logic
 * Priority: Item discount > Sub-brand discount > Brand discount > 0%
 */
export function resolveInclusionDiscount(
  itemId: string,
  brandId: string | null | undefined,
  subBrandId: string | null | undefined,
  inclusionDiscounts: InclusionDiscounts | null | undefined
): number {
  if (!inclusionDiscounts) return 0;

  // Check item first (highest priority)
  if (inclusionDiscounts.items && Array.isArray(inclusionDiscounts.items)) {
    const itemDiscount = inclusionDiscounts.items.find(i => i.id === itemId);
    if (itemDiscount) return Number(itemDiscount.discountPercent);
  }

  // Check sub-brand second
  if (subBrandId && inclusionDiscounts.subBrands && Array.isArray(inclusionDiscounts.subBrands)) {
    const subBrandDiscount = inclusionDiscounts.subBrands.find(sb => sb.id === subBrandId);
    if (subBrandDiscount) return Number(subBrandDiscount.discountPercent);
  }

  // Check brand last
  if (brandId && inclusionDiscounts.brands && Array.isArray(inclusionDiscounts.brands)) {
    const brandDiscount = inclusionDiscounts.brands.find(b => b.id === brandId);
    if (brandDiscount) return Number(brandDiscount.discountPercent);
  }

  // Item not included in rate sheet
  return 0;
}

/**
 * Calculate inclusive tax pricing rate
 * Formula: Final = (baseAmount/(1+(gstRate/100)))*(1-(discountPercent/100))*(1+(gstRate/100))
 * Simplified: Final = baseAmount * (1 - discountPercent/100)
 *
 * This applies discount correctly on tax-inclusive prices
 */
export function calculateInclusiveTaxRate(
  baseAmount: number,
  gstRate: number,
  discountPercent: number
): number {
  const gstFactor = 1 + (gstRate / 100);
  // Extract base price, apply discount, then add tax back
  const result = (baseAmount / gstFactor) * (1 - discountPercent / 100) * gstFactor;
  return Math.round(result * 1000) / 1000;
}

/**
 * Get effective rate V2 - Uses MRP for rate sheet customers, sellingPrice for non-rate sheet customers
 * GST is always inclusive in both cases.
 *
 * @param item - Item details including MRP and sellingPrice
 * @param rateSheet - Customer's rate sheet (if any)
 *
 * Logic:
 * - Customer WITH rate sheet: Use MRP as base, apply rate sheet discounts (inclusive GST)
 * - Customer WITHOUT rate sheet: Use sellingPrice as base, no discount (inclusive GST)
 */
export function getEffectiveRateV2(
  item: {
    id: string;
    mrp: number | Decimal;
    sellingPrice: number | Decimal;
    gstRate: number | Decimal;
    brandId?: string | null;
    subBrandId?: string | null;
  },
  rateSheet?: {
    isActive: boolean;
    useInclusionModel?: boolean;
    discountPercent: number | Decimal;
    inclusionDiscounts?: InclusionDiscounts | null;
    excludedItemIds?: string[];
    excludedBrandIds?: string[];
    excludedSubBrandIds?: string[];
  } | null
): { rate: number; discountPercent: number } {
  const mrp = Number(item.mrp);
  const sellingPrice = Number(item.sellingPrice);
  const gstRate = Number(item.gstRate);

  // No rate sheet - use sellingPrice as base, no discount (GST inclusive)
  if (!rateSheet || !rateSheet.isActive) {
    return { rate: sellingPrice, discountPercent: 0 };
  }

  // Customer has rate sheet - always use MRP as base (GST inclusive)
  // Check if using inclusion model (new system)
  const useInclusionModel = rateSheet.useInclusionModel !== false;

  if (useInclusionModel && rateSheet.inclusionDiscounts) {
    // Inclusion model: Use MRP as base, apply cascade discount
    // Priority: item → sub-brand → brand → default discountPercent
    const inclusionDiscount = resolveInclusionDiscount(
      item.id,
      item.brandId,
      item.subBrandId,
      rateSheet.inclusionDiscounts
    );

    // Use inclusion discount if found, otherwise fall back to the rate
    // sheet's top-level discountPercent (the "default" discount)
    const discountPercent = inclusionDiscount > 0
      ? inclusionDiscount
      : Number(rateSheet.discountPercent);

    if (discountPercent > 0) {
      const rate = calculateInclusiveTaxRate(mrp, gstRate, discountPercent);
      return { rate, discountPercent };
    }

    // No discount at any level — use MRP as-is
    return { rate: mrp, discountPercent: 0 };
  }

  // Legacy exclusion model - still use MRP as base for rate sheet customers
  // Check if item is excluded
  const excludedItemIds = Array.isArray(rateSheet.excludedItemIds) ? rateSheet.excludedItemIds : [];
  const excludedBrandIds = Array.isArray(rateSheet.excludedBrandIds) ? rateSheet.excludedBrandIds : [];
  const excludedSubBrandIds = Array.isArray(rateSheet.excludedSubBrandIds) ? rateSheet.excludedSubBrandIds : [];

  if (excludedItemIds.includes(item.id)) {
    // Excluded item - use MRP with 0% discount
    return { rate: mrp, discountPercent: 0 };
  }
  if (item.brandId && excludedBrandIds.includes(item.brandId)) {
    // Excluded brand - use MRP with 0% discount
    return { rate: mrp, discountPercent: 0 };
  }
  if (item.subBrandId && excludedSubBrandIds.includes(item.subBrandId)) {
    // Excluded sub-brand - use MRP with 0% discount
    return { rate: mrp, discountPercent: 0 };
  }

  // Apply discount percent on MRP
  const discountPercent = Number(rateSheet.discountPercent);
  const rate = calculateInclusiveTaxRate(mrp, gstRate, discountPercent);
  return { rate, discountPercent };
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
    maximumFractionDigits: 3,
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
