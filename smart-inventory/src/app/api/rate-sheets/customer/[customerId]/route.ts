import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/rate-sheets/customer/[customerId] - Get the active rate sheet for a customer
// This is used during sales order creation to calculate discounted prices
export async function GET(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;

    // Verify customer exists
    const customer = await db.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        customerNumber: true,
        name: true,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const now = new Date();

    // Find active rate sheet for this customer
    const rateSheet = await db.rateSheet.findUnique({
      where: { customerId },
    });

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

    // Calculate effective discount
    // Final price = basePrice * (itemRatePercent / 100) * (1 - discountPercent / 100)
    const itemRatePercent = Number(rateSheet.itemRatePercent);
    const discountPercent = Number(rateSheet.discountPercent);

    // Effective rate is the combined effect of item rate and discount
    // e.g., 90% item rate with 10% discount = 90% * 90% = 81% of original price
    const effectiveRatePercent = itemRatePercent * (1 - discountPercent / 100);
    const effectiveDiscount = 100 - effectiveRatePercent;

    return NextResponse.json({
      customer,
      hasRateSheet: true,
      rateSheet: {
        id: rateSheet.id,
        name: rateSheet.name,
        itemRatePercent,
        discountPercent,
        currency: rateSheet.currency,
        roundOff: rateSheet.roundOff,
        validFrom: rateSheet.validFrom,
        validTo: rateSheet.validTo,
        isActive: rateSheet.isActive,
      },
      isEffective,
      effectiveRatePercent: isEffective ? effectiveRatePercent : 100,
      effectiveDiscount: isEffective ? effectiveDiscount : 0,
      currency: rateSheet.currency,
      roundOff: rateSheet.roundOff,
    });
  } catch (error) {
    console.error('Error fetching customer rate sheet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer rate sheet' },
      { status: 500 }
    );
  }
}
