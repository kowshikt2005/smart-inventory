import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { SYSTEM_USER_ID } from '@/lib/order-utils';
import { checkPermission } from '@/lib/api-auth';

// POST /api/items/[id]/adjust-stock - Adjust physical stock for an item
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('masters_items', 'edit');
    if (error) return error;
    const { id } = await params;
    const body = await request.json();

    // Validate required fields
    if (body.newStock === undefined || body.newStock === null) {
      return NextResponse.json(
        { error: 'New stock amount is required' },
        { status: 400 }
      );
    }

    if (body.newStock < 0) {
      return NextResponse.json(
        { error: 'Stock cannot be negative' },
        { status: 400 }
      );
    }

    // Get item with inventory
    const item = await db.item.findUnique({
      where: { id },
      include: {
        inventory: true,
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    const newAvailableStock = Number(body.newStock);
    const currentPhysicalStock = Number(item.inventory?.physicalStock || 0);
    const reservedQty = Number(item.inventory?.reservedQuantity || 0);
    const currentAvailableStock = currentPhysicalStock - reservedQty;
    
    // Calculate what the new physical stock should be to achieve the desired available stock
    const newPhysicalStock = newAvailableStock + reservedQty;
    const adjustment = newPhysicalStock - currentPhysicalStock;

    // Validate that new available stock is not negative
    if (newAvailableStock < 0) {
      return NextResponse.json(
        { error: 'Available stock cannot be negative' },
        { status: 400 }
      );
    }

    // Ensure system user exists
    let systemUser = await db.user.findUnique({
      where: { id: SYSTEM_USER_ID },
    });

    if (!systemUser) {
      systemUser = await db.user.create({
        data: {
          id: SYSTEM_USER_ID,
          email: 'system@ledgerzen.local',
          name: 'System',
          password: 'not-for-login',
          role: 'ADMIN',
          isActive: true,
        },
      });
    }

    // Update stock in transaction
    const result = await transaction(async (tx) => {
      let inventory;

      // Create or update inventory
      if (!item.inventory) {
        inventory = await tx.inventory.create({
          data: {
            itemId: id,
            physicalStock: newPhysicalStock,
            reservedQuantity: 0,
            minStockLevel: item.minStock,
          },
        });
      } else {
        inventory = await tx.inventory.update({
          where: { id: item.inventory.id },
          data: {
            physicalStock: newPhysicalStock,
          },
        });
      }

      // Record stock movement if there's an adjustment
      if (adjustment !== 0) {
        const movementType = adjustment > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
        await tx.stockMovement.create({
          data: {
            inventoryId: inventory.id,
            itemId: id,
            quantity: adjustment,
            type: movementType,
            referenceType: 'MANUAL_ADJUSTMENT',
            referenceId: null,
            notes: body.notes || `Available stock adjusted from ${currentAvailableStock} to ${newAvailableStock} (Physical: ${currentPhysicalStock} to ${newPhysicalStock})`,
            createdBy: SYSTEM_USER_ID,
          },
        });
      }

      return inventory;
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    return NextResponse.json({
      success: true,
      message: 'Available stock adjusted successfully',
      previousAvailableStock: currentAvailableStock,
      newAvailableStock: newAvailableStock,
      previousPhysicalStock: currentPhysicalStock,
      newPhysicalStock: newPhysicalStock,
      adjustment: adjustment,
      inventory: result,
    });
  } catch (error) {
    console.error('Error adjusting stock:', error);
    return NextResponse.json(
      { error: 'Failed to adjust stock' },
      { status: 500 }
    );
  }
}
