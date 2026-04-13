import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { generateInvoiceNumber, calculateDueDate } from '@/lib/invoice-utils';
import { calculateOrderTotals, SYSTEM_USER_ID } from '@/lib/order-utils';
import { checkPermission } from '@/lib/api-auth';

// POST /api/sales-invoices/copy - Duplicate an existing sales invoice
export async function POST(request: Request) {
  try {
    const { error } = await checkPermission('sales_invoices', 'edit');
    if (error) return error;

    const body = await request.json();

    if (!body.sourceInvoiceId) {
      return NextResponse.json({ error: 'Source invoice ID is required' }, { status: 400 });
    }

    // Fetch source invoice with all related data
    const sourceInvoice = await (db.invoice.findUnique as any)({
      where: { id: body.sourceInvoiceId },
      include: {
        customer: { select: { id: true, creditDays: true } },
        items: true,
      },
    });

    if (!sourceInvoice) {
      return NextResponse.json({ error: 'Source invoice not found' }, { status: 404 });
    }

    const newInvoice = await transaction(async (tx) => {
      const invoiceNumber = await generateInvoiceNumber(tx as any);
      const invoiceDate = new Date();
      const dueDate = calculateDueDate(invoiceDate, sourceInvoice.customer.creditDays || 0);

      const invoiceItems = sourceInvoice.items.map((item: {
        itemId: string;
        quantity: number;
        rate: number;
        discountPercent: number | null;
        taxRate: number;
        taxAmount: number;
        amount: number;
      }) => ({
        itemId: item.itemId,
        quantity: item.quantity,
        rate: item.rate,
        discountPercent: item.discountPercent,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        amount: item.amount,
      }));

      const itemTotals = invoiceItems.map((item: { amount: number; taxAmount: number }) => ({
        amount: Number(item.amount),
        taxAmount: Number(item.taxAmount),
      }));
      const { subtotal, totalTax, cgst, sgst, totalAmount } = calculateOrderTotals(itemTotals, 0);

      const created = await (tx.invoice.create as any)({
        data: {
          invoiceNumber,
          invoiceDate,
          customerId: sourceInvoice.customerId,
          subtotal,
          cgst,
          sgst,
          taxAmount: totalTax,
          roundOff: 0,
          totalAmount,
          paidAmount: 0,
          balanceAmount: totalAmount,
          paymentStatus: 'PENDING',
          dueDate,
          notes: sourceInvoice.notes,
          items: { create: invoiceItems },
        },
      });

      // Deduct stock for each item — validate sufficiency before any decrement
      const itemIds = sourceInvoice.items.map((i: { itemId: string }) => i.itemId);
      const inventories = await tx.inventory.findMany({ where: { itemId: { in: itemIds } } });
      const inventoryMap = new Map(
        inventories.map((inv: { itemId: string; id: string; physicalStock: unknown }) => [inv.itemId, inv])
      );

      // Pre-flight check: ensure all items have sufficient stock
      for (const orderItem of sourceInvoice.items) {
        const inventory = inventoryMap.get(orderItem.itemId) as
          | { id: string; physicalStock: unknown }
          | undefined;
        if (inventory) {
          const available = Number(inventory.physicalStock);
          const required = Number(orderItem.quantity);
          if (available < required) {
            throw new Error(
              `Insufficient stock for item ${orderItem.itemId}: available ${available}, required ${required}`
            );
          }
        }
      }

      for (const orderItem of sourceInvoice.items) {
        const inventory = inventoryMap.get(orderItem.itemId) as { id: string } | undefined;
        if (inventory) {
          await tx.inventory.update({
            where: { itemId: orderItem.itemId },
            data: { physicalStock: { decrement: Number(orderItem.quantity) } },
          });
          await (tx.stockMovement.create as any)({
            data: {
              inventoryId: inventory.id,
              itemId: orderItem.itemId,
              quantity: Number(orderItem.quantity),
              type: 'SALE',
              referenceType: 'INVOICE',
              referenceId: created.id,
              notes: `Copied Invoice - ${invoiceNumber} (from ${sourceInvoice.invoiceNumber})`,
              createdBy: SYSTEM_USER_ID,
            },
          });
        }
      }

      // Create customer ledger entry (DEBIT)
      const lastLedgerEntry = await tx.customerLedger.findFirst({
        where: { customerId: sourceInvoice.customerId },
        orderBy: { date: 'desc' },
      });
      const previousBalance = lastLedgerEntry ? Number(lastLedgerEntry.balance) : 0;

      await tx.customerLedger.create({
        data: {
          customerId: sourceInvoice.customerId,
          date: invoiceDate,
          description: `Sales Invoice - ${invoiceNumber} (copy of ${sourceInvoice.invoiceNumber})`,
          type: 'SALES_INVOICE',
          debit: totalAmount,
          credit: 0,
          balance: previousBalance + totalAmount,
          referenceType: 'sales_invoice',
          referenceId: created.id,
        },
      });

      return created;
    });

    return NextResponse.json({ id: newInvoice.id, invoiceNumber: newInvoice.invoiceNumber }, { status: 201 });
  } catch (error) {
    console.error('Error copying invoice:', error);
    const msg = error instanceof Error ? error.message : '';
    if (msg.startsWith('Insufficient stock')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to copy invoice' }, { status: 500 });
  }
}
