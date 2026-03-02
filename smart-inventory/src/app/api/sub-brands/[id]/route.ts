import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';

// GET /api/sub-brands/[id] - Get a specific sub-brand
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('masters_items', 'view');
    if (error) return error;
    const { id } = await params;

    const subBrand = await db.subBrand.findUnique({
      where: { id },
      include: {
        brand: {
          select: { id: true, name: true },
        },
        _count: {
          select: { items: true },
        },
      },
    });

    if (!subBrand) {
      return NextResponse.json(
        { error: 'Sub-brand not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(subBrand);
  } catch (error) {
    console.error('Error fetching sub-brand:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sub-brand' },
      { status: 500 }
    );
  }
}

// PUT /api/sub-brands/[id] - Update a sub-brand
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('masters_items', 'edit');
    if (error) return error;
    const { id } = await params;
    const body = await request.json();

    // Verify sub-brand exists
    const existingSubBrand = await db.subBrand.findUnique({
      where: { id },
    });

    if (!existingSubBrand) {
      return NextResponse.json(
        { error: 'Sub-brand not found' },
        { status: 404 }
      );
    }

    // Check for duplicate name within the same brand (excluding current sub-brand)
    if (body.name && body.name !== existingSubBrand.name) {
      const duplicateSubBrand = await db.subBrand.findFirst({
        where: {
          name: body.name,
          brandId: existingSubBrand.brandId,
          NOT: { id },
        },
      });

      if (duplicateSubBrand) {
        return NextResponse.json(
          { error: 'A sub-brand with this name already exists for this brand' },
          { status: 409 }
        );
      }
    }

    const updatedSubBrand = await db.subBrand.update({
      where: { id },
      data: {
        name: body.name !== undefined ? body.name : existingSubBrand.name,
        discountPercent: body.discountPercent !== undefined
          ? (body.discountPercent === null ? null : parseFloat(body.discountPercent))
          : existingSubBrand.discountPercent,
        logoUrl: body.logoUrl !== undefined ? (body.logoUrl || null) : existingSubBrand.logoUrl,
      },
    });

    return NextResponse.json(updatedSubBrand);
  } catch (error: any) {
    console.error('Error updating sub-brand:', error);

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A sub-brand with this name already exists for this brand' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update sub-brand' },
      { status: 500 }
    );
  }
}

// DELETE /api/sub-brands/[id] - Delete a sub-brand
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('masters_items', 'edit');
    if (error) return error;
    const { id } = await params;

    // Check if sub-brand has items
    const subBrand = await db.subBrand.findUnique({
      where: { id },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    if (!subBrand) {
      return NextResponse.json(
        { error: 'Sub-brand not found' },
        { status: 404 }
      );
    }

    if (subBrand._count.items > 0) {
      return NextResponse.json(
        { error: `Cannot delete sub-brand with ${subBrand._count.items} items. Please reassign or delete items first.` },
        { status: 400 }
      );
    }

    await db.subBrand.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Sub-brand deleted successfully' });
  } catch (error) {
    console.error('Error deleting sub-brand:', error);
    return NextResponse.json(
      { error: 'Failed to delete sub-brand' },
      { status: 500 }
    );
  }
}
