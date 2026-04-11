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
      // Verify all items have sufficient stock for return
      for (const returnItem of existingReturn.items) {
        const inventory = returnItem.item.inventory;
        const currentStock = inventory ? Number(inventory.physicalStock) : 0;
        const returnQty = Number(returnItem.quantity);

        if (currentStock < returnQty) {
          return NextResponse.json(
            {
              error: `Insufficient stock for ${returnItem.item.name}. Available: ${currentStock}, Return Qty: ${returnQty}`,
            },
            { status: 400 }
          );
        }
      }

      const completedReturn = await transaction(async (tx) => {
        const claim = await tx.purchaseReturn.updateMany({
          where: {
            id,
            status: 'OPEN',
          },
          data: {
            status: 'COMPLETED',
            notes: reason
              ? `${existingReturn.notes ? existingReturn.notes + '\n' : ''}[Status: COMPLETED] ${reason}`
              : existingReturn.notes,
          },
        });

        if (claim.count !== 1) {
          throw new Error('RETURN_ALREADY_COMPLETED');
        }

        // Update inventory - decrease physical stock for each item
        for (const returnItem of existingReturn.items) {
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
            throw new Error(`Insufficient stock for item ${returnItem.itemId}`);
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
              notes: `Purchase return ${existingReturn.returnNumber}`,
            },
          });
        }

        const lastLedgerEntry = await tx.vendorLedger.findFirst({
          where: { vendorId: existingReturn.vendorId },
          orderBy: { createdAt: 'desc' },
        });

        const previousBalance = lastLedgerEntry
          ? Number(lastLedgerEntry.balance)
          : Number(existingReturn.vendor.openingBalance);
        const newBalance = previousBalance - Number(existingReturn.totalAmount);

        await tx.vendorLedger.create({
          data: {
            vendorId: existingReturn.vendorId,
            date: existingReturn.date,
            description: `Purchase Return ${existingReturn.returnNumber}`,
            type: 'PURCHASE_RETURN',
            debit: Number(existingReturn.totalAmount),
            credit: 0,
            balance: newBalance,
            referenceType: 'purchase_return',
            referenceId: id,
          },
        });

        if (existingReturn.purchaseInvoiceId) {
          const invoice = await tx.purchaseInvoice.findUnique({
            where: { id: existingReturn.purchaseInvoiceId },
          });

          if (invoice) {
            const invoiceNewBalance = Math.max(0, Number(invoice.balanceAmount) - Number(existingReturn.totalAmount));
            const invoiceNewStatus = invoiceNewBalance <= 0.01 ? 'PAID' : invoice.status;

            await tx.purchaseInvoice.update({
              where: { id: existingReturn.purchaseInvoiceId },
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