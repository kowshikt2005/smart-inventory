import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';

// GET /api/items/[id] - Get a specific item
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('masters_items', 'view');
    if (error) return error;
    const { id } = await params;
    const item = await db.item.findUnique({
      where: { id },
      include: {
        brand: true,
        subBrand: true,
        inventory: true,
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error('Error fetching item:', error);
    return NextResponse.json(
      { error: 'Failed to fetch item' },
      { status: 500 }
    );
  }
}

// PUT /api/items/[id] - Update an item
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('masters_items', 'edit');
    if (error) return error;
    const { id } = await params;
    const body = await request.json();

    // Check if item exists
    const existingItem = await (db.item.findUnique as any)({
      where: { id },
    }) as any;

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Check if item code is being changed and if it already exists
    if (body.itemCode && body.itemCode !== existingItem.itemCode) {
      const duplicateItem = await db.item.findUnique({
        where: { itemCode: body.itemCode },
      });

      if (duplicateItem) {
        return NextResponse.json(
          { error: 'Item code already exists' },
          { status: 409 }
        );
      }
    }

    // Update item
    const updatedItem = await (db.item.update as any)({
      where: { id },
      data: {
        itemCode: body.itemCode || existingItem.itemCode,
        userCode: body.userCode !== undefined ? (body.userCode || null) : existingItem.userCode,
        barcode: body.barcode !== undefined ? (body.barcode || null) : existingItem.barcode,
        name: body.name || existingItem.name,
        description: body.description !== undefined ? body.description : existingItem.description,
        brandId: body.brandId !== undefined ? body.brandId : existingItem.brandId,
        subBrandId: body.subBrandId !== undefined ? body.subBrandId : existingItem.subBrandId,
        hsnCode: body.hsnCode !== undefined ? body.hsnCode : existingItem.hsnCode,
        gstRate: body.gstRate !== undefined ? body.gstRate : existingItem.gstRate,
        purchasePrice: body.purchasePrice !== undefined ? body.purchasePrice : existingItem.purchasePrice,
        mrp: body.mrp !== undefined ? body.mrp : existingItem.mrp,
        sellingPrice: body.sellingPrice !== undefined ? body.sellingPrice : existingItem.sellingPrice,
        margin: body.margin !== undefined ? body.margin : existingItem.margin,
        marginType: body.marginType !== undefined ? body.marginType : existingItem.marginType,
        minStock: body.minStock !== undefined ? body.minStock : existingItem.minStock,
        unit: body.unit || existingItem.unit,
        uomConversions: body.uomConversions !== undefined ? body.uomConversions : existingItem.uomConversions,
        imageUrl: body.imageUrl !== undefined ? body.imageUrl : existingItem.imageUrl,
        isActive: body.isActive !== undefined ? (typeof body.isActive === 'boolean' ? body.isActive : existingItem.isActive) : existingItem.isActive,
      },
      include: {
        brand: true,
        subBrand: true,
      },
    });

    // Update inventory min stock level if changed (separate query to avoid transaction issues)
    if (body.minStock !== undefined) {
      try {
        await db.inventory.update({
          where: { itemId: id },
          data: {
            minStockLevel: body.minStock,
          },
        });
      } catch (invError) {
        console.warn('Failed to update inventory minStockLevel, but item was updated:', invError);
      }
    }

    return NextResponse.json(updatedItem);
  } catch (error: any) {
    console.error('Error updating item:', error);

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Item code already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    );
  }
}

// DELETE /api/items/[id] - Delete an item
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('masters_items', 'edit');
    if (error) return error;
    const { id } = await params;
    // Check if item exists
    const existingItem = await db.item.findUnique({
      where: { id },
      include: {
        salesOrderItems: true,
        purchaseOrderItems: true,
      },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Check if item is being used in any transactions
    if (
      existingItem.salesOrderItems.length > 0 ||
      existingItem.purchaseOrderItems.length > 0
    ) {
      return NextResponse.json(
        { error: 'Cannot delete item that is being used in transactions' },
        { status: 400 }
      );
    }

    // Delete item (inventory will be deleted due to cascade)
    await db.item.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    );
  }
}