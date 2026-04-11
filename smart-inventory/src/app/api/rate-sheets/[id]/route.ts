import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { cache, cacheKeys } from '@/lib/cache';
import { checkPermission } from '@/lib/api-auth';

// GET /api/rate-sheets/[id] - Get a single rate sheet
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('masters_rate_sheets', 'view');
    if (error) return error;

    const { id } = await params;

    const rateSheet = await db.rateSheet.findUnique({
      where: { id },
      include: {
        customers: {
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
    const { error } = await checkPermission('masters_rate_sheets', 'edit');
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    // Check if rate sheet exists and get current customers for cache invalidation
    const [existingRateSheet, existingCustomers] = await Promise.all([
      db.rateSheet.findUnique({ where: { id } }),
      db.rateSheetCustomer.findMany({ where: { rateSheetId: id }, select: { customerId: true } }),
    ]);

    if (!existingRateSheet) {
      return NextResponse.json(
        { error: 'Rate sheet not found' },
        { status: 404 }
      );
    }

    // Build update data for the rate sheet itself
    const updateData: any = {};

    if (body.name !== undefined && String(body.name).trim()) {
      updateData.name = String(body.name).trim();
    }
    if (body.validFrom !== undefined) updateData.validFrom = new Date(body.validFrom);
    if (body.validTo !== undefined) updateData.validTo = body.validTo ? new Date(body.validTo) : null;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.excludedItemIds !== undefined) updateData.excludedItemIds = body.excludedItemIds || [];
    if (body.excludedBrandIds !== undefined) updateData.excludedBrandIds = body.excludedBrandIds || [];
    if (body.excludedSubBrandIds !== undefined) updateData.excludedSubBrandIds = body.excludedSubBrandIds || [];
    if (body.useInclusionModel !== undefined) updateData.useInclusionModel = body.useInclusionModel;
    if (body.inclusionDiscounts !== undefined) updateData.inclusionDiscounts = body.inclusionDiscounts || {};

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

    // Run update + customer list change in a transaction
    const rateSheet = await transaction(async (tx) => {
      // Update rate sheet fields
      if (Object.keys(updateData).length > 0) {
        await tx.rateSheet.update({ where: { id }, data: updateData });
      }

      // If customerIds provided, replace the customer list
      if (Array.isArray(body.customerIds)) {
        // Validate customers exist
        const customers = await tx.customer.findMany({
          where: { id: { in: body.customerIds } },
          select: { id: true },
        });
        if (customers.length !== body.customerIds.length) {
          throw new Error('One or more customers not found');
        }

        // Delete all existing join entries, re-create with new list
        await tx.rateSheetCustomer.deleteMany({ where: { rateSheetId: id } });
        if (body.customerIds.length > 0) {
          await tx.rateSheetCustomer.createMany({
            data: body.customerIds.map((customerId: string) => ({
              rateSheetId: id,
              customerId,
            })),
          });
        }
      }

      // Return updated rate sheet with customers
      return tx.rateSheet.findUnique({
        where: { id },
        include: {
          customers: {
            include: {
              customer: {
                select: { id: true, customerNumber: true, name: true },
              },
            },
          },
        },
      });
    });

    // Invalidate rate sheet cache for old customers
    for (const entry of existingCustomers) {
      cache.delete(cacheKeys.rateSheet(entry.customerId));
    }
    // Invalidate cache for new customers (if customer list was updated)
    if (Array.isArray(body.customerIds)) {
      for (const customerId of body.customerIds) {
        cache.delete(cacheKeys.rateSheet(customerId));
      }
      // Customer assignments changed; clear all customer rate-sheet entries defensively.
      cache.invalidatePrefix('rate-sheet:');
    }

    return NextResponse.json(rateSheet);
  } catch (error: any) {
    console.error('Error updating rate sheet:', error);

    if (error.message === 'One or more customers not found') {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

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
    const { error: delError } = await checkPermission('masters_rate_sheets', 'edit');
    if (delError) return delError;

    const { id } = await params;

    const [existingRateSheet, affectedCustomers] = await Promise.all([
      db.rateSheet.findUnique({ where: { id } }),
      db.rateSheetCustomer.findMany({ where: { rateSheetId: id }, select: { customerId: true } }),
    ]);

    if (!existingRateSheet) {
      return NextResponse.json(
        { error: 'Rate sheet not found' },
        { status: 404 }
      );
    }

    // Cascade delete handles join table entries automatically
    await db.rateSheet.delete({ where: { id } });

    // Invalidate rate sheet cache for all affected customers
    for (const entry of affectedCustomers) {
      cache.delete(cacheKeys.rateSheet(entry.customerId));
    }
    cache.invalidatePrefix('rate-sheet:');

    return NextResponse.json({ message: 'Rate sheet deleted successfully' });
  } catch (error) {
    console.error('Error deleting rate sheet:', error);
    return NextResponse.json(
      { error: 'Failed to delete rate sheet' },
      { status: 500 }
    );
  }
}
