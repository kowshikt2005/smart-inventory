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

    const negativeBillingSetting = await db.appSetting.findUnique({
      where: { key: 'negative_billing' },
      select: { value: true },
    });
    const negativeBillingEnabled = negativeBillingSetting?.value === 'true';

    // Validate discount bounds on all items
    for (const item of items) {
      const dp = Number(item.discountPercent || 0);
      if (dp < 0 || dp > 100) {
        return NextResponse.json({ error: 'Discount percent must be between 0 and 100' }, { status: 400 });
      }
      if (Number(item.rate) < 0) {
        return NextResponse.json({ error: 'Item rate cannot be negative' }, { status: 400 });
      }
      if (Number(item.quantity) < 0) {
        return NextResponse.json({ error: 'Item quantity cannot be negative' }, { status: 400 });
      }
    }

    const validItems: Array<{ itemId: string; quantity: number; rate: number; taxRate: number; discountPercent: number; amount: number; taxAmount: number }> = items.filter(
      (item: { itemId?: string; quantity?: number; rate?: number }) => item.itemId && Number(item.quantity) > 0 && Number(item.rate) >= 0
    ).map((item: { itemId: string; quantity: number; rate: number; taxRate?: number; discountPercent?: number; isGstInclusive?: boolean }) => {
      const qty = Number(item.quantity);
      const taxRate = Number(item.taxRate || 0);
      const discountFactor = 1 - Number(item.discountPercent || 0) / 100;
      const isGstInclusive = item.isGstInclusive || false;

      let baseAmount: number;
      let taxAmount: number;

      if (isGstInclusive) {
        const totalInclusive = qty * Number(item.rate) * discountFactor;
        baseAmount = totalInclusive / (1 + taxRate / 100);
        taxAmount = totalInclusive - baseAmount;
      } else {
        baseAmount = qty * Number(item.rate) * discountFactor;
        taxAmount = baseAmount * (taxRate / 100);
      }

      return {
        itemId: item.itemId,
        quantity: qty,
        rate: Number(item.rate),
        taxRate,
        discountPercent: Number(item.discountPercent || 0),
        amount: Math.round(baseAmount * 1000) / 1000,
        taxAmount: Math.round(taxAmount * 1000) / 1000,
      };
    });

    if (validItems.length === 0) {
      return NextResponse.json({ error: 'No valid items provided' }, { status: 400 });
    }

    if (!negativeBillingEnabled) {
      const requiredByItem = new Map<string, number>();
      for (const orderItem of validItems) {
        requiredByItem.set(
          orderItem.itemId,
          (requiredByItem.get(orderItem.itemId) || 0) + Number(orderItem.quantity)
        );
      }

      const itemIds = [...requiredByItem.keys()];
      const catalogItems = await db.item.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, itemCode: true, name: true },
      });

      if (catalogItems.length !== itemIds.length) {
        return NextResponse.json({ error: 'One or more items not found' }, { status: 400 });
      }

      const itemMeta = new Map(catalogItems.map((item) => [item.id, item]));
      const inventories = await db.inventory.findMany({
        where: { itemId: { in: itemIds } },
        select: { itemId: true, physicalStock: true },
      });
      const stockMap = new Map(inventories.map((inv) => [inv.itemId, Number(inv.physicalStock)]));

      const insufficientStock = itemIds
        .map((itemId) => {
          const required = Number(requiredByItem.get(itemId) || 0);
          const available = Number(stockMap.get(itemId) || 0);
          if (available < required) {
            const meta = itemMeta.get(itemId);
            return {
              itemId,
              itemCode: meta?.itemCode || itemId,
              itemName: meta?.name || 'Unknown Item',
              required,
              available,
              shortfall: required - available,
            };
          }
          return null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

      if (insufficientStock.length > 0) {
        return NextResponse.json(
          {
            error: 'Insufficient stock for one or more items',
            insufficientStock,
          },
          { status: 400 }
        );
      }
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
        if (!negativeBillingEnabled) {
          const updated = await tx.inventory.updateMany({
            where: {
              itemId: orderItem.itemId,
              physicalStock: { gte: orderItem.quantity },
            },
            data: { physicalStock: { decrement: orderItem.quantity } },
          });

          if (updated.count !== 1) {
            throw new Error(`Insufficient stock for item ${orderItem.itemId}.`);
          }

          const lockedInventory = await tx.inventory.findUniqueOrThrow({
            where: { itemId: orderItem.itemId },
            select: { id: true },
          });

          stockMovements.push({
            inventoryId: lockedInventory.id,
            itemId: orderItem.itemId,
            quantity: orderItem.quantity,
            type: 'SALE',
            referenceType: 'INVOICE',
            referenceId: newInvoice.id,
            notes: `Direct Invoice - ${invoiceNumber}`,
            createdBy: userId || null,
          });
          continue;
        }

        const updatedInventory = await tx.inventory.upsert({
          where: { itemId: orderItem.itemId },
          create: {
            itemId: orderItem.itemId,
            physicalStock: -orderItem.quantity,
            reservedQuantity: 0,
            minStockLevel: 0,
          },
          update: {
            physicalStock: { decrement: orderItem.quantity },
          },
        });

        stockMovements.push({
          inventoryId: inv?.id || updatedInventory.id,
          itemId: orderItem.itemId,
          quantity: orderItem.quantity,
          type: 'SALE',
          referenceType: 'INVOICE',
          referenceId: newInvoice.id,
          notes: `Direct Invoice - ${invoiceNumber}`,
          createdBy: userId || null,
        });
      }

      if (stockMovements.length > 0) {
        await tx.stockMovement.createMany({ data: stockMovements });
      }

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

    if (error instanceof Error && error.message.startsWith('Insufficient stock for item')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}
