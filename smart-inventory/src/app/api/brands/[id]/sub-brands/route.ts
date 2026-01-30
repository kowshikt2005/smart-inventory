import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/brands/[id]/sub-brands - Get sub-brands for a specific brand
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const subBrands = await db.subBrand.findMany({
      where: { brandId: id },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ subBrands });
  } catch (error) {
    console.error('Error fetching sub-brands:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sub-brands' },
      { status: 500 }
    );
  }
}

// POST /api/brands/[id]/sub-brands - Create a new sub-brand
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: 'Sub-brand name is required' },
        { status: 400 }
      );
    }

    // Check if brand exists
    const brand = await db.brand.findUnique({
      where: { id },
    });

    if (!brand) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }

    // Check if sub-brand already exists for this brand
    const existingSubBrand = await db.subBrand.findUnique({
      where: {
        name_brandId: {
          name: body.name,
          brandId: id,
        },
      },
    });

    if (existingSubBrand) {
      return NextResponse.json(
        { error: 'Sub-brand already exists for this brand' },
        { status: 409 }
      );
    }

    const subBrand = await db.subBrand.create({
      data: {
        name: body.name,
        brandId: id,
        discountPercent: body.discountPercent !== undefined
          ? parseFloat(body.discountPercent)
          : null,
      },
    });

    return NextResponse.json(subBrand, { status: 201 });
  } catch (error: any) {
    console.error('Error creating sub-brand:', error);

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Sub-brand already exists for this brand' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create sub-brand' },
      { status: 500 }
    );
  }
}