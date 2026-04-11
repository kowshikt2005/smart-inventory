import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';

// POST /api/purchase-returns/[id]/complete - Complete a purchase return
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('purchases_returns', 'edit');
    if (error) return error;

    const { id } = await params;

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

    // Only allow completing OPEN returns
    if (existingReturn.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'Only OPEN returns can be completed' },
        { status: 400 }
      );
    }

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

    // Complete the return in a transaction
    const completedReturn = await transaction(async (tx) => {
      const claim = await tx.purchaseReturn.updateMany({
        where: {
          id,
          status: 'OPEN',
        },
        data: {
          status: 'COMPLETED',
        },
      });

      if (claim.count !== 1) {
        throw new Error('RETURN_ALREADY_COMPLETED');
      }

      // Update inventory - decrease physical stock for each item
      for (const returnItem of existingReturn.items) {
        const inventory = returnItem.item.inventory;

        if (inventory) {
          // Update existing inventory
          await tx.inventory.update({
            where: { itemId: returnItem.itemId },
            data: {
              physicalStock: {
                decrement: Number(returnItem.quantity),
              },
            },
          });

          // Create stock movement record
          await tx.stockMovement.create({
            data: {
              inventoryId: inventory.id,
              itemId: returnItem.itemId,
              quantity: -Number(returnItem.quantity), // Negative for decrease
              type: 'RETURN',
              referenceType: 'PURCHASE_RETURN',
              referenceId: id,
              notes: `Purchase return ${existingReturn.returnNumber}`,
            },
          });
        }
      }

      // Get the last ledger entry for this vendor to calculate running balance
      const lastLedgerEntry = await tx.vendorLedger.findFirst({
        where: { vendorId: existingReturn.vendorId },
        orderBy: { createdAt: 'desc' },
      });

      const previousBalance = lastLedgerEntry
        ? Number(lastLedgerEntry.balance)
        : Number(existingReturn.vendor.openingBalance);
      // Purchase return decreases what we owe to vendor (debit to vendor = we owe less)
      const newBalance = previousBalance - Number(existingReturn.totalAmount);

      // Create vendor ledger entry
      await tx.vendorLedger.create({
        data: {
          vendorId: existingReturn.vendorId,
          date: existingReturn.date,
          description: `Purchase Return ${existingReturn.returnNumber}`,
          type: 'PURCHASE_RETURN',
          debit: Number(existingReturn.totalAmount), // Debit means vendor owes us (reduces our liability)
          credit: 0,
          balance: newBalance,
          referenceType: 'purchase_return',
          referenceId: id,
        },
      });

      // If linked to invoice, reduce the invoice's balance
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

      const updated = await tx.purchaseReturn.findUniqueOrThrow({
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

      return {
        ...updated,
        status: 'COMPLETED',
      };
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    return NextResponse.json(completedReturn);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'RETURN_ALREADY_COMPLETED') {
      return NextResponse.json(
        { error: 'Purchase return is already completed by another request' },
        { status: 409 }
      );
    }

    console.error('Error completing purchase return:', error);

    const prismaError = error as { code?: string };

    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        { error: 'Purchase return not found' },
        { status: 404 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to complete purchase return';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
