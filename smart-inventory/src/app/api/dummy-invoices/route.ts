import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { generateDummyInvoiceNumber, calculateDueDate } from '@/lib/invoice-utils';
import { calculateOrderTotals, calculateLineItemV2 } from '@/lib/order-utils';

// GET /api/dummy-invoices — list all DI-xxxx invoices
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '15');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.AND = [
        { invoiceNumber: { startsWith: 'DI-' } },
        {
          OR: [
            { invoiceNumber: { contains: search } },
            { customer: { name: { contains: search } } },
            { customer: { customerNumber: { contains: search } } },
          ],
        },
      ];
    } else {
      where.invoiceNumber = { startsWith: 'DI-' };
    }

    if (status && status !== 'ALL') {
      where.paymentStatus = status;
    }

    const now = new Date();

    const [invoices, total] = await Promise.all([
      db.invoice.findMany({
        where,
        include: {
          customer: {
            select: { id: true, customerNumber: true, name: true, creditDays: true },
          },
        },
        skip,
        take: limit,
        orderBy: { invoiceDate: 'desc' },
      }),
      db.invoice.count({ where }),
    ]);

    const invoicesWithStatus = invoices.map((invoice) => {
      let effectiveStatus = invoice.paymentStatus;
      if (
        invoice.paymentStatus === 'PENDING' &&
        invoice.dueDate &&
        new Date(invoice.dueDate) < now &&
        Number(invoice.balanceAmount) > 0
      ) {
        effectiveStatus = 'OVERDUE';
      }
      return { ...invoice, effectiveStatus };
    });

    return NextResponse.json({
      invoices: invoicesWithStatus,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching dummy invoices:', error);
    return NextResponse.json({ error: 'Failed to fetch dummy invoices' }, { status: 500 });
  }
}

// POST /api/dummy-invoices — create a dummy invoice directly (no sales order)
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.customerId) {
      return NextResponse.json({ error: 'Customer is required' }, { status: 400 });
    }
    if (!body.invoiceDate) {
      return NextResponse.json({ error: 'Invoice date is required' }, { status: 400 });
    }
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    for (const item of body.items) {
      if (!item.quantity || item.quantity <= 0) {
        return NextResponse.json({ error: 'All quantities must be greater than 0' }, { status: 400 });
      }
      if (!item.rate || item.rate <= 0) {
        return NextResponse.json({ error: 'All rates must be greater than 0' }, { status: 400 });
      }
    }

    const customer = await db.customer.findUnique({ where: { id: body.customerId } });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const itemIds: string[] = body.items.map((i: { itemId: string }) => i.itemId);
    const dbItems = await db.item.findMany({ where: { id: { in: itemIds } } });
    if (dbItems.length !== itemIds.length) {
      return NextResponse.json({ error: 'One or more items not found' }, { status: 400 });
    }

    const invoice = await transaction(async (tx) => {
      const invoiceNumber = await generateDummyInvoiceNumber(tx as any);
      const invoiceDate = new Date(body.invoiceDate);
      const dueDate = calculateDueDate(invoiceDate, customer.creditDays);

      // discountPercent > 0 → rate is MRP (inclusive), else → rate is selling price (exclusive)
      const invoiceItems = body.items.map((item: { itemId: string; quantity: number; rate: number; discountPercent?: number; taxRate: number }) => {
        const discountPercent = item.discountPercent || 0;
        const { amount, taxAmount } = calculateLineItemV2(
          item.quantity,
          item.rate,
          item.taxRate,
          discountPercent
        );

        return {
          itemId: item.itemId,
          quantity: item.quantity,
          rate: item.rate,
          discountPercent,
          taxRate: item.taxRate,
          amount,
          taxAmount,
        };
      });

      const { subtotal, totalTax, cgst, sgst, totalAmount } = calculateOrderTotals(
        invoiceItems.map((i: { amount: number; taxAmount: number }) => ({ amount: i.amount, taxAmount: i.taxAmount })),
        0
      );

      const newInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          invoiceDate,
          salesOrderId: null,
          orderNumber: null,
          customerId: body.customerId,
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
          notes: body.notes || null,
          items: { create: invoiceItems },
        },
        include: {
          customer: { select: { id: true, customerNumber: true, name: true } },
          items: { include: { item: { select: { id: true, itemCode: true, name: true, unit: true } } } },
        },
      });

      // Deduct stock — allow negative (no validation)
      const inventories = await tx.inventory.findMany({ where: { itemId: { in: itemIds } } });
      const inventoryMap = new Map(inventories.map((inv) => [inv.itemId, inv]));
      const stockMovements: { inventoryId: string; itemId: string; quantity: number; type: 'SALE'; referenceType: string; referenceId: string; notes: string }[] = [];

      for (const item of body.items) {
        let inventory = inventoryMap.get(item.itemId);
        if (inventory) {
          await tx.inventory.update({
            where: { itemId: item.itemId },
            data: { physicalStock: { decrement: item.quantity } },
          });
        } else {
          inventory = await tx.inventory.create({
            data: {
              itemId: item.itemId,
              physicalStock: -item.quantity,
              reservedQuantity: 0,
              minStockLevel: 0,
            },
          });
        }
        stockMovements.push({
          inventoryId: inventory.id,
          itemId: item.itemId,
          quantity: item.quantity,
          type: 'SALE',
          referenceType: 'INVOICE',
          referenceId: newInvoice.id,
          notes: `Dummy Invoice - ${invoiceNumber}`,
        });
      }

      if (stockMovements.length > 0) {
        await tx.stockMovement.createMany({ data: stockMovements });
      }

      // Customer ledger entry
      const lastLedgerEntry = await tx.customerLedger.findFirst({
        where: { customerId: body.customerId },
        orderBy: { date: 'desc' },
      });
      const previousBalance = lastLedgerEntry ? Number(lastLedgerEntry.balance) : 0;

      await tx.customerLedger.create({
        data: {
          customerId: body.customerId,
          date: invoiceDate,
          description: `Dummy Invoice - ${invoiceNumber}`,
          type: 'SALES_INVOICE',
          debit: totalAmount,
          credit: 0,
          balance: previousBalance + totalAmount,
          referenceType: 'sales_invoice',
          referenceId: newInvoice.id,
        },
      });

      return newInvoice;
    }, { maxWait: 15000, timeout: 45000 });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error('Error creating dummy invoice:', error);
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2002') {
      return NextResponse.json({ error: 'Invoice number already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create dummy invoice' }, { status: 500 });
  }
}
