import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/brands - Get all brands
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const includeSubBrands = searchParams.get('includeSubBrands') === 'true';

    const where = search
      ? {
          name: { contains: search },
        }
      : {};

    const brands = await db.brand.findMany({
      where,
      orderBy: { name: 'asc' },
      include: includeSubBrands
        ? {
            subBrands: {
              orderBy: { name: 'asc' },
            },
          }
        : undefined,
    });

    return NextResponse.json({ brands });
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