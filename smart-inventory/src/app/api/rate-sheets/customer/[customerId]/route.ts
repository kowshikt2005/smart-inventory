import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cache, cacheKeys, cacheTTL } from '@/lib/cache';

// GET /api/rate-sheets/customer/[customerId] - Get the active rate sheet for a customer
// This is used during sales order creation to calculate discounted prices
export async function GET(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;

    // Use cache for frequently accessed rate sheets
    const cachedData = await cache.getOrSet(
      cacheKeys.rateSheet(customerId),
      async () => {
        // Fetch customer and rate sheet in parallel
        const [customer, rateSheet] = await Promise.all([
          db.customer.findUnique({
            where: { id: customerId },
            select: {
              id: true,
              customerNumber: true,
              name: true,
            },
          }),
          db.rateSheet.findUnique({
            where: { customerId },
          }),
        ]);

        return { customer, rateSheet };
      },
      cacheTTL.RATE_SHEET
    );

    const { customer, rateSheet } = cachedData;

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const now = new Date();

    // Check if rate sheet is valid and active
    if (!rateSheet) {
      return NextResponse.json({
        customer,
        hasRateSheet: false,
        rateSheet: null,
        effectiveDiscount: 0,
        effectiveRatePercent: 100,
        message: 'No rate sheet configured for this customer',
      });
    }

    // Check if rate sheet is active and within validity period
    const isActive = rateSheet.isActive;
    const isValidFrom = rateSheet.validFrom <= now;
    const isValidTo = !rateSheet.validTo || rateSheet.validTo >= now;
    const isEffective = isActive && isValidFrom && isValidTo;

    // Simple discount calculation
    const discountPercent = Number(rateSheet.discountPercent);

    return NextResponse.json({
      customer,
      hasRateSheet: true,
      rateSheet: {
        id: rateSheet.id,
        name: rateSheet.name,
        discountPercent,
        excludedItemIds: rateSheet.excludedItemIds,
        excludedBrandIds: rateSheet.excludedBrandIds,
        excludedSubBrandIds: rateSheet.excludedSubBrandIds,
        validFrom: rateSheet.validFrom,
        validTo: rateSheet.validTo,
        isActive: rateSheet.isActive,
      },
      isEffective,
      discountPercent: isEffective ? discountPercent : 0,
    });
  } catch (error) {
    console.error('Error fetching customer rate sheet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer rate sheet' },
      { status: 500 }
    );
  }
}
