import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';

// POST /api/sales-returns/[id]/complete - Complete sales return (restore inventory, update invoice, create ledger entry)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('sales_returns', 'edit');
    if (error) return error;
    const { id } = await params;

    const salesReturn = await db.salesReturn.findUnique({
      where: { id },
      include: {
        customer: true,
        invoice: true,
        items: {
          include: {
            item: {
              include: {
                inventory: true,
              },
            },
          },
        },
      },
    });

    if (!salesReturn) {
      return NextResponse.json(
        { error: 'Sales return not found' },
        { status: 404 }
      );
    }

    if (salesReturn.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'Can only complete OPEN sales returns' },
        { status: 400 }
      );
    }

    // Complete return in transaction - OPTIMIZED VERSION
    await transaction(async (tx) => {
      // Prepare batch operations
      const inventoryUpdates: Promise<any>[] = [];
      const stockMovements: any[] = [];
      
      // Process all items in parallel
      for (const returnItem of salesReturn.items) {
        const inventory = returnItem.item.inventory;

        if (inventory) {
          // Add inventory update to batch
          inventoryUpdates.push(
            tx.inventory.update({
              where: { id: inventory.id },
              data: {
                physicalStock: {
                  increment: Number(returnItem.quantity),
                },
              },
            })
          );

          // Prepare stock movement data
          stockMovements.push({
            inventoryId: inventory.id,
            itemId: returnItem.itemId,
            quantity: Number(returnItem.quantity),
            type: 'RETURN',
            referenceType: 'SALES_RETURN',
            referenceId: salesReturn.id,
            notes: `Sales return ${salesReturn.returnNumber}`,
          });
        }
      }

      // Execute all inventory updates in parallel
      await Promise.all(inventoryUpdates);

      // Batch create all stock movements
      if (stockMovements.length > 0) {
        await tx.stockMovement.createMany({
          data: stockMovements,
        });
      }

      // Get customer's opening balance more efficiently
      const customerBalance = await tx.customerLedger.aggregate({
        where: { customerId: salesReturn.customerId },
        _sum: {
          debit: true,
          credit: true,
        },
      });

      const currentBalance = Number(customerBalance._sum.debit || 0) - Number(customerBalance._sum.credit || 0);
      const newBalance = currentBalance - Number(salesReturn.totalAmount);

      // Update the original invoice if linked
      let invoiceUpdatePromise: Promise<any> = Promise.resolve();
      if (salesReturn.invoice) {
        const invoice = salesReturn.invoice;
        const returnAmount = Number(salesReturn.totalAmount);

        // Calculate new balance amount (return acts as a credit)
        // Keep totalAmount unchanged for record keeping
        const newBalanceAmount = Math.max(0, Number(invoice.balanceAmount) - returnAmount);

        // Determine new payment status
        let newPaymentStatus = invoice.paymentStatus;
        if (newBalanceAmount <= 0) {
          newPaymentStatus = 'PAID';
        } else if (Number(invoice.paidAmount) > 0 || returnAmount > 0) {
          newPaymentStatus = 'PARTIAL';
        }

        invoiceUpdatePromise = tx.invoice.update({
          where: { id: invoice.id },
          data: {
            balanceAmount: newBalanceAmount,
            paymentStatus: newPaymentStatus,
          },
        });
      }

      // Create customer ledger entry, update return status, and update invoice in parallel
      await Promise.all([
        tx.customerLedger.create({
          data: {
            customerId: salesReturn.customerId,
            date: salesReturn.returnDate,
            description: `Sales Return - ${salesReturn.returnNumber}`,
            type: 'SALES_RETURN',
            debit: 0,
            credit: Number(salesReturn.totalAmount),
            balance: newBalance,
            referenceType: 'sales_return',
            referenceId: salesReturn.id,
          },
        }),
        tx.salesReturn.update({
          where: { id },
          data: {
            status: 'COMPLETED',
          },
        }),
        invoiceUpdatePromise,
      ]);
    }, {
      maxWait: 15000, // Increased timeout for batch operations
      timeout: 45000,
    });

    // Return success without refetching (client will refresh)
    return NextResponse.json({ 
      success: true, 
      message: 'Sales return completed successfully',
      id: salesReturn.id,
      returnNumber: salesReturn.returnNumber,
      status: 'COMPLETED'
    });
  } catch (error) {
    console.error('Error completing sales return:', error);
    return NextResponse.json(
      { error: 'Failed to complete sales return' },
      { status: 500 }
    );
  }
}
