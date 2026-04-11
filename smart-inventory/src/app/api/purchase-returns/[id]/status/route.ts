import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { isValidPRStatusTransition } from '@/lib/purchase-utils';
import { checkPermission } from '@/lib/api-auth';

// PATCH /api/purchase-returns/[id]/status - Update purchase return status
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('purchases_returns', 'edit');
    if (error) return error;
    const { id } = await params;
    const body = await request.json();

    const { status: newStatus, reason } = body;

    if (!newStatus) {
      return NextResponse.json(
        { error: 'New status is required' },
        { status: 400 }
      );
    }

    // Find existing return
    const existingReturn = await db.purchaseReturn.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            item: {
              include: {
                inventory: true,
              },
            },
          },
        },
        vendor: true,
      },
    });

    if (!existingReturn) {
      return NextResponse.json(
        { error: 'Purchase return not found' },
        { status: 404 }
      );
    }

    // Validate status transition
    if (!isValidPRStatusTransition(existingReturn.status, newStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status transition from ${existingReturn.status} to ${newStatus}`,
          currentStatus: existingReturn.status,
          allowedTransitions: ['OPEN', 'COMPLETED', 'CANCELLED'].filter(s =>
            isValidPRStatusTransition(existingReturn.status, s)
          ),
        },
        { status: 400 }
      );
    }

    // Additional validation for specific transitions
    if (newStatus === 'COMPLETED' && existingReturn.status !== 'OPEN') {
      return NextResponse.json(
        { 
          error: 'Only OPEN returns can be marked as completed' 
        },
        { status: 400 }
      );
    }

    if (newStatus === 'CANCELLED' && existingReturn.status === 'COMPLETED') {
      return NextResponse.json(
        { 
          error: 'Cannot cancel a completed return' 
        },
        { status: 400 }
      );
    }

    // COMPLETED is not a plain status flip: it must also mutate inventory + ledgers.
    if (newStatus === 'COMPLETED') {
      const completedReturn = await transaction(async (tx) => {
        const currentReturn = await tx.purchaseReturn.findUnique({
          where: { id },
          include: {
            items: {
              include: {
                item: {
                  include: {
                    inventory: true,
                  },
                },
              },
            },
            vendor: true,
          },
        });

        if (!currentReturn) {
          throw new Error('RETURN_NOT_FOUND');
        }

        if (currentReturn.status !== 'OPEN') {
          throw new Error('RETURN_NOT_OPEN');
        }

        for (const returnItem of currentReturn.items) {
          const inventory = returnItem.item.inventory;
          const currentStock = inventory ? Number(inventory.physicalStock) : 0;
          const returnQty = Number(returnItem.quantity);

          if (currentStock < returnQty) {
            throw new Error(
              `INSUFFICIENT_STOCK:${returnItem.item.name}:${currentStock}:${returnQty}`
            );
          }
        }

        const claim = await tx.purchaseReturn.updateMany({
          where: {
            id,
            status: 'OPEN',
          },
          data: {
            status: 'COMPLETED',
            notes: reason
              ? `${currentReturn.notes ? currentReturn.notes + '\n' : ''}[Status: COMPLETED] ${reason}`
              : currentReturn.notes,
          },
        });

        if (claim.count !== 1) {
          throw new Error('RETURN_ALREADY_COMPLETED');
        }

        // Update inventory - decrease physical stock for each item
        for (const returnItem of currentReturn.items) {
          const updated = await tx.inventory.updateMany({
            where: {
              itemId: returnItem.itemId,
              physicalStock: { gte: Number(returnItem.quantity) },
            },
            data: {
              physicalStock: {
                decrement: Number(returnItem.quantity),
              },
            },
          });

          if (updated.count !== 1) {
            throw new Error(`INSUFFICIENT_STOCK:${returnItem.item.name}:0:${Number(returnItem.quantity)}`);
          }

          const inventory = await tx.inventory.findUniqueOrThrow({
            where: { itemId: returnItem.itemId },
            select: { id: true },
          });

          await tx.stockMovement.create({
            data: {
              inventoryId: inventory.id,
              itemId: returnItem.itemId,
              quantity: -Number(returnItem.quantity),
              type: 'RETURN',
              referenceType: 'PURCHASE_RETURN',
              referenceId: id,
              notes: `Purchase return ${currentReturn.returnNumber}`,
            },
          });
        }

        const lastLedgerEntry = await tx.vendorLedger.findFirst({
          where: { vendorId: currentReturn.vendorId },
          orderBy: { createdAt: 'desc' },
        });

        const previousBalance = lastLedgerEntry
          ? Number(lastLedgerEntry.balance)
          : Number(currentReturn.vendor.openingBalance);
        const newBalance = previousBalance - Number(currentReturn.totalAmount);

        await tx.vendorLedger.create({
          data: {
            vendorId: currentReturn.vendorId,
            date: currentReturn.date,
            description: `Purchase Return ${currentReturn.returnNumber}`,
            type: 'PURCHASE_RETURN',
            debit: Number(currentReturn.totalAmount),
            credit: 0,
            balance: newBalance,
            referenceType: 'purchase_return',
            referenceId: id,
          },
        });

        if (currentReturn.purchaseInvoiceId) {
          const invoice = await tx.purchaseInvoice.findUnique({
            where: { id: currentReturn.purchaseInvoiceId },
          });

          if (invoice) {
            const invoiceNewBalance = Math.max(0, Number(invoice.balanceAmount) - Number(currentReturn.totalAmount));
            const invoiceNewStatus = invoiceNewBalance <= 0.01 ? 'PAID' : invoice.status;

            await tx.purchaseInvoice.update({
              where: { id: currentReturn.purchaseInvoiceId },
              data: {
                balanceAmount: invoiceNewBalance,
                status: invoiceNewStatus,
              },
            });
          }
        }

        return tx.purchaseReturn.findUniqueOrThrow({
          where: { id },
          include: {
            vendor: {
              select: {
                id: true,
                vendorNumber: true,
                name: true,
              },
            },
            items: {
              include: {
                item: {
                  select: {
                    id: true,
                    itemCode: true,
                    name: true,
                    unit: true,
                  },
                },
              },
            },
          },
        });
      });

      return NextResponse.json(completedReturn);
    }

    // Regular status updates (OPEN -> CANCELLED)
    const updatedReturn = await db.purchaseReturn.update({
      where: { id },
      data: {
        status: newStatus,
        notes: reason
          ? `${existingReturn.notes ? existingReturn.notes + '\n' : ''}[Status: ${newStatus}] ${reason}`
          : existingReturn.notes,
      },
      include: {
        vendor: {
          select: {
            id: true,
            vendorNumber: true,
            name: true,
          },
        },
        items: {
          include: {
            item: {
              select: {
                id: true,
                itemCode: true,
                name: true,
                unit: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(updatedReturn);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'RETURN_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Purchase return not found' },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message === 'RETURN_NOT_OPEN') {
      return NextResponse.json(
        { error: 'Purchase return is no longer OPEN. Please refresh and retry.' },
        { status: 409 }
      );
    }

    if (error instanceof Error && error.message.startsWith('INSUFFICIENT_STOCK:')) {
      const [, itemName, available, required] = error.message.split(':');
      return NextResponse.json(
        {
          error: `Insufficient stock for ${itemName}. Available: ${available}, Return Qty: ${required}`,
        },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'RETURN_ALREADY_COMPLETED') {
      return NextResponse.json(
        { error: 'Purchase return is already completed by another request' },
        { status: 409 }
      );
    }

    console.error('Error updating purchase return status:', error);

    const prismaError = error as { code?: string };

    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        { error: 'Purchase return not found' },
        { status: 404 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to update purchase return status';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}