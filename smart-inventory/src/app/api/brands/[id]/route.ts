import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';

// GET /api/brands/[id] - Get a specific brand
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('masters_items', 'view');
    if (error) return error;
    const { id } = await params;

    const brand = await db.brand.findUnique({
      where: { id },
      include: {
        subBrands: {
          orderBy: { name: 'asc' },
        },
        preferredVendor: {
          select: { id: true, name: true },
        },
        _count: {
          select: { items: true },
        },
      },
    });

    if (!brand) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(brand);
  } catch (error) {
    console.error('Error fetching brand:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brand' },
      { status: 500 }
    );
  }
}

// PUT /api/brands/[id] - Update a brand
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('masters_items', 'edit');
    if (error) return error;
    const { id } = await params;
    const body = await request.json();

    // Verify brand exists
    const existingBrand = await db.brand.findUnique({
      where: { id },
    });

    if (!existingBrand) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }

    // Check for duplicate name (excluding current brand)
    if (body.name && body.name !== existingBrand.name) {
      const duplicateBrand = await db.brand.findUnique({
        where: { name: body.name },
      });

      if (duplicateBrand) {
        return NextResponse.json(
          { error: 'A brand with this name already exists' },
          { status: 409 }
        );
      }
    }

    const deactivating = body.isActive === false && existingBrand.isActive === true;
    const activating = body.isActive === true && existingBrand.isActive === false;

    const updatedBrand = await db.$transaction(async (tx) => {
      const brand = await tx.brand.update({
        where: { id },
        data: {
          name: body.name !== undefined ? body.name : existingBrand.name,
          discountPercent: body.discountPercent !== undefined
            ? (body.discountPercent === null ? null : parseFloat(body.discountPercent))
            : existingBrand.discountPercent,
          logoUrl: body.logoUrl !== undefined ? (body.logoUrl || null) : existingBrand.logoUrl,
          preferredVendorId: body.preferredVendorId !== undefined
            ? (body.preferredVendorId || null)
            : existingBrand.preferredVendorId,
          isActive: body.isActive !== undefined ? body.isActive : existingBrand.isActive,
        },
      });

      // Cascade deactivation: sub-brands and their items become inactive
      if (deactivating) {
        await tx.subBrand.updateMany({ where: { brandId: id }, data: { isActive: false } });
        await tx.item.updateMany({ where: { brandId: id }, data: { isActive: false } });
      }

      // Cascade activation: bring sub-brands and items back when the brand is reactivated
      if (activating) {
        await tx.subBrand.updateMany({ where: { brandId: id }, data: { isActive: true } });
        await tx.item.updateMany({ where: { brandId: id }, data: { isActive: true } });
      }

      return brand;
    });

    return NextResponse.json(updatedBrand);
  } catch (error: any) {
    console.error('Error updating brand:', error);

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A brand with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update brand' },
      { status: 500 }
    );
  }
}

// DELETE /api/brands/[id] - Delete a brand
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('masters_items', 'edit');
    if (error) return error;
    const { id } = await params;

    // Check if brand has items
    const brand = await db.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: { items: true, subBrands: true },
        },
      },
    });

    if (!brand) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }

    if (brand._count.items > 0) {
      return NextResponse.json(
        { error: `Cannot delete brand with ${brand._count.items} items. Please reassign or delete items first.` },
        { status: 400 }
      );
    }

    // Delete brand (will cascade delete sub-brands)
    await db.brand.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Brand deleted successfully' });
  } catch (error) {
    console.error('Error deleting brand:', error);
    return NextResponse.json(
      { error: 'Failed to delete brand' },
      { status: 500 }
    );
  }
}
