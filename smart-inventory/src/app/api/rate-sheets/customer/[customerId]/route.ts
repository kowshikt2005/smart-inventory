import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cache, cacheKeys, cacheTTL } from '@/lib/cache';
import { checkPermission } from '@/lib/api-auth';

// GET /api/rate-sheets/customer/[customerId] - Get the active rate sheet for a customer
// This is used during sales order creation to calculate discounted prices.
// If a customer belongs to multiple rate sheets, the most recently created active one wins.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { error } = await checkPermission('masters_rate_sheets', 'view');
    if (error) return error;

    const { customerId } = await params;

    const cachedData = await cache.getOrSet(
      cacheKeys.rateSheet(customerId),
      async () => {
        // Fetch customer and all rate sheets for this customer via join table
        const [customer, joinEntries] = await Promise.all([
          db.customer.findUnique({
            where: { id: customerId },
            select: { id: true, customerNumber: true, name: true },
          }),
          db.rateSheetCustomer.findMany({
            where: { customerId },
            include: {
              rateSheet: true,
            },
            orderBy: { rateSheet: { createdAt: 'desc' } },
          }),
        ]);

        // Pick the most recent rate sheet (first after desc sort)
        const rateSheet = joinEntries.length > 0 ? joinEntries[0].rateSheet : null;

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

    const discountPercent = Number(rateSheet.discountPercent);

    return NextResponse.json({
      customer,
      hasRateSheet: true,
      rateSheet: {
        id: rateSheet.id,
        name: rateSheet.name,
        discountPercent,
        validFrom: rateSheet.validFrom,
        validTo: rateSheet.validTo,
        isActive: rateSheet.isActive,
        useInclusionModel: rateSheet.useInclusionModel,
        inclusionDiscounts: rateSheet.inclusionDiscounts,
        excludedItemIds: rateSheet.excludedItemIds || [],
        excludedBrandIds: rateSheet.excludedBrandIds || [],
        excludedSubBrandIds: rateSheet.excludedSubBrandIds || [],
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
