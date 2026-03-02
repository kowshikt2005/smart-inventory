import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';

// GET /api/customers - Get all customers with optional search and pagination
export async function GET(request: Request) {
  try {
    const { error } = await checkPermission('masters_customers', 'view');
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get('limit') || '10') || 10));
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const skip = (page - 1) * limit;

    // Build where clause for search and active filter
    const where: Record<string, unknown> = {};
    if (activeOnly) where.status = 'ACTIVE';
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { gstin: { contains: search } },
        { city: { contains: search } },
        { state: { contains: search } },
        { email: { contains: search } },
        { customerNumber: { contains: search } },
      ];
    }

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
    const { error } = await checkPermission('masters_customers', 'edit');
    if (error) return error;
    const body = await request.json();

    // Validate required fields
    const requiredFields = [
      'name',
      'gstin',
      'state',
      'city',
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
    if (body.gstin && body.gstin.length !== 15) {
      return NextResponse.json(
        { error: 'GSTIN must be exactly 15 characters' },
        { status: 400 }
      );
    }

    // Create customer
    const customer = await db.customer.create({
      data: {
        customerNumber: `customer-${Date.now()}`, // Generate customer number
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        gstin: body.gstin,
        state: body.state,
        city: body.city,
        address: `${body.addressLine1}${body.addressLine2 ? ', ' + body.addressLine2 : ''}`,
        pincode: body.pincode || null,
        openingBalance: body.openingBalance || 0,
        creditDays: body.creditDays || 0,
        creditLimit: body.creditLimit || 0,
        status: 'ACTIVE',
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error('Error creating customer:', error);

    // Handle unique constraint violation (duplicate GSTIN)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
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
