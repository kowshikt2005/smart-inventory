import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/rate-sheets - Get all rate sheets
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (activeOnly) {
      where.isActive = true;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { customer: { name: { contains: search } } },
        { customer: { customerNumber: { contains: search } } },
      ];
    }

    // Get rate sheets with customer relation
    const [rateSheets, total] = await Promise.all([
      db.rateSheet.findMany({
        where,
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
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['name', 'customerId', 'validFrom'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate customer exists
    const customer = await db.customer.findUnique({
      where: { id: body.customerId },
    });
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Check if customer already has a rate sheet
    const existingRateSheet = await db.rateSheet.findUnique({
      where: { customerId: body.customerId },
    });

    if (existingRateSheet) {
      return NextResponse.json(
        { error: 'This customer already has a rate sheet. Please edit the existing one.' },
        { status: 409 }
      );
    }

    // Validate itemRatePercent (must be between 0 and 200)
    const itemRatePercent = parseFloat(body.itemRatePercent) || 100;
    if (itemRatePercent < 0 || itemRatePercent > 200) {
      return NextResponse.json(
        { error: 'Item rate percent must be between 0 and 200' },
        { status: 400 }
      );
    }

    // Validate discountPercent (must be between 0 and 100)
    const discountPercent = parseFloat(body.discountPercent) || 0;
    if (discountPercent < 0 || discountPercent > 100) {
      return NextResponse.json(
        { error: 'Discount percent must be between 0 and 100' },
        { status: 400 }
      );
    }

    // Create rate sheet
    const rateSheet = await db.rateSheet.create({
      data: {
        name: body.name,
        customerId: body.customerId,
        validFrom: new Date(body.validFrom),
        validTo: body.validTo ? new Date(body.validTo) : null,
        itemRatePercent,
        discountPercent,
        excludedItemIds: body.excludedItemIds || [],
        currency: body.currency || 'INR',
        roundOff: body.roundOff || 'NONE',
        isActive: body.isActive !== false, // Default to true
      },
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

    return NextResponse.json(rateSheet, { status: 201 });
  } catch (error: any) {
    console.error('Error creating rate sheet:', error);

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A rate sheet for this customer already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create rate sheet' },
      { status: 500 }
    );
  }
}
