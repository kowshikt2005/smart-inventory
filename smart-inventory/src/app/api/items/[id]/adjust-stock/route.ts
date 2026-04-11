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

    const newPhysicalStock = Number(body.newStock);

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
      const item = await tx.item.findUnique({
        where: { id },
        include: {
          inventory: true,
        },
      });

      if (!item) {
        throw new Error('ITEM_NOT_FOUND');
      }

      const currentPhysicalStock = Number(item.inventory?.physicalStock || 0);
      const adjustment = newPhysicalStock - currentPhysicalStock;

      let inventory;

      // Create or update inventory with optimistic guard to avoid lost updates.
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
        const updated = await tx.inventory.updateMany({
          where: {
            id: item.inventory.id,
            physicalStock: currentPhysicalStock,
          },
          data: {
            physicalStock: newPhysicalStock,
          },
        });

        if (updated.count !== 1) {
          throw new Error('STOCK_CONFLICT');
        }

        inventory = await tx.inventory.findUniqueOrThrow({ where: { id: item.inventory.id } });
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
            notes: body.notes || `Physical stock adjusted from ${currentPhysicalStock} to ${newPhysicalStock}`,
            createdBy: SYSTEM_USER_ID,
          },
        });
      }

      return {
        inventory,
        currentPhysicalStock,
        adjustment,
      };
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    return NextResponse.json({
      success: true,
      message: 'Physical stock adjusted successfully',
      previousPhysicalStock: result.currentPhysicalStock,
      newPhysicalStock: newPhysicalStock,
      adjustment: result.adjustment,
      inventory: result.inventory,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'ITEM_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message === 'STOCK_CONFLICT') {
      return NextResponse.json(
        { error: 'Stock was updated by another request. Please retry.' },
        { status: 409 }
      );
    }

    console.error('Error adjusting stock:', error);
    return NextResponse.json(
      { error: 'Failed to adjust stock' },
      { status: 500 }
    );
  }
}
