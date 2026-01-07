import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/customers - Get all customers with optional search and pagination
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // Build where clause for search
    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { gstin: { contains: search } },
            { city: { contains: search } },
            { state: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {};

    // Get customers with pagination
    const [customers, total] = await Promise.all([
      db.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.customer.count({ where }),
    ]);

    return NextResponse.json({
      customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}

// POST /api/customers - Create a new customer
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = [
      'name',
      'gstin',
      'state',
      'stateCode',
      'city',
      'addressLine1',
      'openingAsOfDate',
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate GSTIN format (15 characters)
    if (body.gstin.length !== 15) {
      return NextResponse.json(
        { error: 'GSTIN must be exactly 15 characters' },
        { status: 400 }
      );
    }

    // Validate state code (2 characters)
    if (body.stateCode.length !== 2) {
      return NextResponse.json(
        { error: 'State code must be exactly 2 characters' },
        { status: 400 }
      );
    }

    // Create customer
    const customer = await db.customer.create({
      data: {
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        gstin: body.gstin,
        state: body.state,
        stateCode: body.stateCode,
        city: body.city,
        addressLine1: body.addressLine1,
        addressLine2: body.addressLine2 || null,
        openingBalance: body.openingBalance || 0,
        openingAsOfDate: new Date(body.openingAsOfDate),
        creditDays: body.creditDays || 0,
        creditLimit: body.creditLimit || 0,
        hasPriceList: body.hasPriceList || false,
        rateSheet: body.rateSheet || null,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error: any) {
    console.error('Error creating customer:', error);

    // Handle unique constraint violation (duplicate GSTIN)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A customer with this GSTIN already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    );
  }
}
