import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/rate-sheets/[id] - Get a single rate sheet
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rateSheet = await db.rateSheet.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            customerNumber: true,
            name: true,
            gstin: true,
            city: true,
            state: true,
          },
        },
      },
    });

    if (!rateSheet) {
      return NextResponse.json(
        { error: 'Rate sheet not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(rateSheet);
  } catch (error) {
    console.error('Error fetching rate sheet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rate sheet' },
      { status: 500 }
    );
  }
}

// PUT /api/rate-sheets/[id] - Update a rate sheet
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if rate sheet exists
    const existingRateSheet = await db.rateSheet.findUnique({
      where: { id },
    });

    if (!existingRateSheet) {
      return NextResponse.json(
        { error: 'Rate sheet not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};

    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    if (body.validFrom !== undefined) {
      updateData.validFrom = new Date(body.validFrom);
    }

    if (body.validTo !== undefined) {
      updateData.validTo = body.validTo ? new Date(body.validTo) : null;
    }

    if (body.itemRatePercent !== undefined) {
      const itemRatePercent = parseFloat(body.itemRatePercent);
      if (itemRatePercent < 0 || itemRatePercent > 200) {
        return NextResponse.json(
          { error: 'Item rate percent must be between 0 and 200' },
          { status: 400 }
        );
      }
      updateData.itemRatePercent = itemRatePercent;
    }

    if (body.discountPercent !== undefined) {
      const discountPercent = parseFloat(body.discountPercent);
      if (discountPercent < 0 || discountPercent > 100) {
        return NextResponse.json(
          { error: 'Discount percent must be between 0 and 100' },
          { status: 400 }
        );
      }
      updateData.discountPercent = discountPercent;
    }

    if (body.currency !== undefined) {
      updateData.currency = body.currency;
    }

    if (body.roundOff !== undefined) {
      updateData.roundOff = body.roundOff;
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }

    if (body.excludedItemIds !== undefined) {
      updateData.excludedItemIds = body.excludedItemIds || [];
    }

    const rateSheet = await db.rateSheet.update({
      where: { id },
      data: updateData,
      include: {
        customer: {
          select: {
            id: true,
            customerNumber: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(rateSheet);
  } catch (error) {
    console.error('Error updating rate sheet:', error);
    return NextResponse.json(
      { error: 'Failed to update rate sheet' },
      { status: 500 }
    );
  }
}

// DELETE /api/rate-sheets/[id] - Delete a rate sheet
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if rate sheet exists
    const existingRateSheet = await db.rateSheet.findUnique({
      where: { id },
    });

    if (!existingRateSheet) {
      return NextResponse.json(
        { error: 'Rate sheet not found' },
        { status: 404 }
      );
    }

    // Delete the rate sheet
    await db.rateSheet.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Rate sheet deleted successfully' });
  } catch (error) {
    console.error('Error deleting rate sheet:', error);
    return NextResponse.json(
      { error: 'Failed to delete rate sheet' },
      { status: 500 }
    );
  }
}
