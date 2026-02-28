import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/brands - Get all brands (with optional pagination)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const includeSubBrands = searchParams.get('includeSubBrands') === 'true';
    // Optional pagination - if not provided, returns all (backward compatible)
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : null;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : null;

    const where = search
      ? {
          name: { contains: search },
        }
      : {};

    // Use parallel queries for efficiency
    const [brands, total] = await Promise.all([
      db.brand.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          preferredVendor: { select: { id: true, name: true } },
          ...(includeSubBrands ? { subBrands: { orderBy: { name: 'asc' } } } : {}),
        },
        ...(page && limit ? { skip: (page - 1) * limit, take: limit } : {}),
      }),
      page && limit ? db.brand.count({ where }) : Promise.resolve(0),
    ]);

    return NextResponse.json({
      brands,
      ...(page && limit ? {
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      } : {}),
    });
  } catch (error) {
    console.error('Error fetching brands:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brands' },
      { status: 500 }
    );
  }
}

// POST /api/brands - Create a new brand
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: 'Brand name is required' },
        { status: 400 }
      );
    }

    // Check if brand already exists
    const existingBrand = await db.brand.findUnique({
      where: { name: body.name },
    });

    if (existingBrand) {
      return NextResponse.json(
        { error: 'Brand already exists' },
        { status: 409 }
      );
    }

    const brand = await db.brand.create({
      data: {
        name: body.name,
        discountPercent: body.discountPercent !== undefined ? parseFloat(body.discountPercent) : null,
        logoUrl: body.logoUrl || null,
      },
    });

    return NextResponse.json(brand, { status: 201 });
  } catch (error: any) {
    console.error('Error creating brand:', error);

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Brand already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create brand' },
      { status: 500 }
    );
  }
}