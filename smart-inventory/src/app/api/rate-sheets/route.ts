import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { cache, cacheKeys } from '@/lib/cache';
import { checkPermission } from '@/lib/api-auth';

// GET /api/rate-sheets - Get all rate sheets
export async function GET(request: Request) {
  try {
    const { error } = await checkPermission('masters_rate_sheets', 'view');
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const customerId = searchParams.get('customerId') || '';
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (activeOnly) {
      where.isActive = true;
    }

    if (customerId) {
      where.customers = { some: { customerId } };
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { customers: { some: { customer: { name: { contains: search } } } } },
        { customers: { some: { customer: { customerNumber: { contains: search } } } } },
      ];
    }

    // Get rate sheets with customers via join table
    const [rateSheets, total] = await Promise.all([
      db.rateSheet.findMany({
        where,
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
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.rateSheet.count({ where }),
    ]);

    return NextResponse.json({
      rateSheets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching rate sheets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rate sheets' },
      { status: 500 }
    );
  }
}

// POST /api/rate-sheets - Create a new rate sheet
export async function POST(request: Request) {
  try {
    const { error } = await checkPermission('masters_rate_sheets', 'edit');
    if (error) return error;

    const body = await request.json();

    // Validate required fields
    if (!body.validFrom) {
      return NextResponse.json(
        { error: 'Missing required field: validFrom' },
        { status: 400 }
      );
    }
    if (!Array.isArray(body.customerIds) || body.customerIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one customer must be selected' },
        { status: 400 }
      );
    }

    // Validate all customers exist
    const customers = await db.customer.findMany({
      where: { id: { in: body.customerIds } },
      select: { id: true },
    });
    if (customers.length !== body.customerIds.length) {
      return NextResponse.json(
        { error: 'One or more customers not found' },
        { status: 404 }
      );
    }

    const generatedName = body.name?.trim() || `Rate Sheet - ${new Date().toISOString().split('T')[0]} - ${body.customerIds.length} customer(s)`;

    // Validate discountPercent (must be between 0 and 100)
    const discountPercent = parseFloat(body.discountPercent) || 0;
    if (discountPercent < 0 || discountPercent > 100) {
      return NextResponse.json(
        { error: 'Discount percent must be between 0 and 100' },
        { status: 400 }
      );
    }

    // Create rate sheet and join table entries in a transaction
    const rateSheet = await transaction(async (tx) => {
      const created = await tx.rateSheet.create({
        data: {
          name: generatedName,
          validFrom: new Date(body.validFrom),
          validTo: body.validTo ? new Date(body.validTo) : null,
          discountPercent,
          excludedItemIds: body.excludedItemIds || [],
          excludedBrandIds: body.excludedBrandIds || [],
          excludedSubBrandIds: body.excludedSubBrandIds || [],
          useInclusionModel: body.useInclusionModel !== false,
          inclusionDiscounts: body.inclusionDiscounts || {},
          isActive: body.isActive !== false,
        },
      });

      // Create join table entries for all selected customers
      await tx.rateSheetCustomer.createMany({
        data: body.customerIds.map((customerId: string) => ({
          rateSheetId: created.id,
          customerId,
        })),
      });

      // Return with customers included
      return tx.rateSheet.findUnique({
        where: { id: created.id },
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

    // Invalidate rate sheet cache for all affected customers
    for (const customerId of body.customerIds) {
      cache.delete(cacheKeys.rateSheet(customerId));
    }
    // Defensive: assignment changes can affect effective pricing across customers.
    cache.invalidatePrefix('rate-sheet:');

    return NextResponse.json(rateSheet, { status: 201 });
  } catch (error: any) {
    console.error('Error creating rate sheet:', error);

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Duplicate customer assignment detected' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create rate sheet' },
      { status: 500 }
    );
  }
}
