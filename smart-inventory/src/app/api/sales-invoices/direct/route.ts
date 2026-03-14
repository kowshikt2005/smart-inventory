import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { StockMovementType } from '@/generated/prisma';
import { generateInvoiceNumber, calculateDueDate } from '@/lib/invoice-utils';
import { calculateOrderTotals } from '@/lib/order-utils';
import { normalizeRoundOffMode, resolveRoundOff } from '@/lib/rounding-utils';
import { checkPermission } from '@/lib/api-auth';
import { auth } from '@/lib/auth';

// POST /api/sales-invoices/direct - Create a direct sales invoice (without a sales order)
export async function POST(request: Request) {
  try {
    const { error } = await checkPermission('sales_invoices', 'edit');
    if (error) return error;

    const session = await auth();
    const userId = session?.user?.id;

    const body = await request.json();

    const { customerId, invoiceDate, dueDate, items, notes, ref, roundOff = 0 } = body;

    if (!customerId) {
      return NextResponse.json({ error: 'Customer is required' }, { status: 400 });
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    const customer = await db.customer.findUnique({
      where: { id: customerId },
      select: { id: true, creditDays: true },
    });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const roundOffSetting = await db.appSetting.findUnique({
      where: { key: 'invoice_roundoff_mode' },
      select: { value: true },
    });
    const effectiveRoundOffMode = normalizeRoundOffMode(body.roundOffMode || roundOffSetting?.value);

    const validItems: Array<{ itemId: string; quantity: number; rate: number; taxRate: number; discountPercent: number; amount: number; taxAmount: number }> = items.filter(
      (item: { itemId?: string; quantity?: number; rate?: number }) => item.itemId && Number(item.quantity) > 0 && Number(item.rate) >= 0
    ).map((item: { itemId: string; quantity: number; rate: number; taxRate?: number; discountPercent?: number; isGstInclusive?: boolean }) => {
      const qty = Number(item.quantity);
      const taxRate = Number(item.taxRate || 0);
      const isGstInclusive = item.isGstInclusive || false;

      let baseAmount: number;
      let taxAmount: number;

      if (isGstInclusive) {
        const totalInclusive = qty * Number(item.rate);
        baseAmount = totalInclusive / (1 + taxRate / 100);
        taxAmount = totalInclusive - baseAmount;
      } else {
        baseAmount = qty * Number(item.rate);
        taxAmount = baseAmount * (taxRate / 100);
      }

      return {
        itemId: item.itemId,
        quantity: qty,
        rate: Number(item.rate),
        taxRate,
        discountPercent: Number(item.discountPercent || 0),
        amount: Math.round(baseAmount * 100) / 100,
        taxAmount: Math.round(taxAmount * 100) / 100,
      };
    });

    if (validItems.length === 0) {
      return NextResponse.json({ error: 'No valid items provided' }, { status: 400 });
    }

    const invoice = await transaction(async (tx) => {
      const invoiceNumber = await generateInvoiceNumber(tx as any);

      const invoiceDateObj = invoiceDate ? new Date(invoiceDate) : new Date();
      const dueDateObj = dueDate
        ? new Date(dueDate)
        : calculateDueDate(invoiceDateObj, customer.creditDays);

      const itemTotals = validItems.map((i) => ({ amount: i.amount, taxAmount: i.taxAmount }));
      const baseTotals = calculateOrderTotals(itemTotals, 0);
      const roundOffDecision = resolveRoundOff(
        baseTotals.subtotal + baseTotals.totalTax,
        effectiveRoundOffMode,
        Number(roundOff)
      );
      const { subtotal, totalTax, cgst, sgst, totalAmount } = calculateOrderTotals(
        itemTotals,
        roundOffDecision.roundOff
      );

      const newInvoice = await (tx.invoice.create as any)({
        data: {
          invoiceNumber,
          invoiceDate: invoiceDateObj,
          customerId,
          subtotal,
          cgst,
          sgst,
          taxAmount: totalTax,
          roundOff: roundOffDecision.roundOff,
          totalAmount,
          paidAmount: 0,
          balanceAmount: totalAmount,
          paymentStatus: 'PENDING',
          dueDate: dueDateObj,
          notes: notes || null,
          ref: ref || null,
          items: {
            create: validItems,
          },
        },
        include: {
          customer: { select: { id: true, customerNumber: true, name: true } },
          items: { include: { item: { select: { id: true, itemCode: true, name: true, unit: true } } } },
        },
      });

      // Deduct stock
      const itemIds = validItems.map((i) => i.itemId);
      const inventories = await tx.inventory.findMany({ where: { itemId: { in: itemIds } } });
      const inventoryMap = new Map(inventories.map((inv) => [inv.itemId, inv]));

      const inventoryUpdates: Promise<unknown>[] = [];
      const stockMovements: Array<{
        inventoryId: string;
        itemId: string;
        quantity: number;
        type: StockMovementType;
        referenceType: string;
        referenceId: string;
        notes: string;
        createdBy: string | null;
      }> = [];

      for (const orderItem of validItems) {
        const inv = inventoryMap.get(orderItem.itemId);
        if (inv) {
          inventoryUpdates.push(
            tx.inventory.update({
              where: { itemId: orderItem.itemId },
              data: { physicalStock: { decrement: orderItem.quantity } },
            })
          );
          stockMovements.push({
            inventoryId: inv.id,
            itemId: orderItem.itemId,
            quantity: orderItem.quantity,
            type: 'SALE',
            referenceType: 'INVOICE',
            referenceId: newInvoice.id,
            notes: `Direct Invoice - ${invoiceNumber}`,
            createdBy: userId || null,
          });
        }
      }

      await Promise.all([
        ...inventoryUpdates,
        stockMovements.length > 0
          ? tx.stockMovement.createMany({ data: stockMovements })
          : Promise.resolve(),
      ]);

      // Customer ledger entry
      const lastLedgerEntry = await tx.customerLedger.findFirst({
        where: { customerId },
        orderBy: { date: 'desc' },
      });
      const previousBalance = lastLedgerEntry ? Number(lastLedgerEntry.balance) : 0;

      await tx.customerLedger.create({
        data: {
          customerId,
          date: invoiceDateObj,
          description: `Sales Invoice - ${invoiceNumber}`,
          type: 'SALES_INVOICE',
          debit: totalAmount,
          credit: 0,
          balance: previousBalance + totalAmount,
          referenceType: 'sales_invoice',
          referenceId: newInvoice.id,
        },
      });

      return newInvoice;
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error('Error creating direct sales invoice:', error);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}
