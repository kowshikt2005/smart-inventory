import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/vendors - Get all vendors with optional search and pagination
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get('limit') || '10') || 10));
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const skip = (page - 1) * limit;

    // Build where clause for search and active filter
    const where: Record<string, unknown> = {};
    if (activeOnly) where.isActive = true;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { gstin: { contains: search } },
        { city: { contains: search } },
        { state: { contains: search } },
        { email: { contains: search } },
      ];
    }

    // Get vendors with pagination
    const [vendors, total] = await Promise.all([
      db.vendor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.vendor.count({ where }),
    ]);

    return NextResponse.json({
      vendors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendors' },
      { status: 500 }
    );
  }
}

// POST /api/vendors - Create a new vendor
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['name'];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate GSTIN format if provided (15 characters)
    if (body.gstin && body.gstin.length !== 15) {
      return NextResponse.json(
        { error: 'GSTIN must be exactly 15 characters' },
        { status: 400 }
      );
    }

    // Generate vendor number (VEN-xxxx format)
    // Get the latest vendor number
    const latestVendor = await db.vendor.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { vendorNumber: true },
    });

    let nextNumber = 1;
    if (latestVendor && latestVendor.vendorNumber) {
      const match = latestVendor.vendorNumber.match(/VEN-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    const vendorNumber = `VEN-${nextNumber.toString().padStart(4, '0')}`;

    // Create vendor
    const vendor = await db.vendor.create({
      data: {
        vendorNumber,
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        gstin: body.gstin || null,
        state: body.state || null,
        city: body.city || null,
        address: body.address || null,
        pincode: body.pincode || null,
        creditDays: body.creditDays || 0,
        openingBalance: body.openingBalance || 0,
        isActive: body.isActive ?? true,
      },
    });

    return NextResponse.json(vendor, { status: 201 });
  } catch (error) {
    console.error('Error creating vendor:', error);

    // Handle unique constraint violation
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A vendor with this information already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create vendor' },
      { status: 500 }
    );
  }
}
