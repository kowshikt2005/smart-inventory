import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateInvoiceNumber, calculateDueDate } from '@/lib/invoice-utils';
import { calculateOrderTotals } from '@/lib/order-utils';
import { calculateStockAllocation, getOrderAllocation, calculateOrderStockStatus } from '@/lib/stock-allocation';

// GET /api/sales-invoices - Get all invoices with filtering
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const customerId = searchParams.get('customerId') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '15');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (status && status !== 'ALL') {
      where.paymentStatus = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { orderNumber: { contains: search } },
        { customer: { name: { contains: search } } },
        { customer: { customerNumber: { contains: search } } },
      ];
    }

    // Get invoices with relations
    const [invoices, total] = await Promise.all([
      db.invoice.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              customerNumber: true,
              name: true,
              gstin: true,
              city: true,
              state: true,
              creditDays: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { invoiceDate: 'desc' },
      }),
      db.invoice.count({ where }),
    ]);

    // Check for overdue invoices and update status
    const now = new Date();
    const invoicesWithStatus = invoices.map((invoice) => {
      let effectiveStatus = invoice.paymentStatus;

      // If pending and past due date, mark as overdue
      if (
        invoice.paymentStatus === 'PENDING' &&
        invoice.dueDate &&
        new Date(invoice.dueDate) < now &&
        Number(invoice.balanceAmount) > 0
      ) {
        effectiveStatus = 'OVERDUE';
      }

      return {
        ...invoice,
        effectiveStatus,
      };
    });

    // Calculate overall stats (not just current page)
    const allInvoices = await db.invoice.findMany({
      select: {
        paymentStatus: true,
        balanceAmount: true,
        dueDate: true,
      },
    });

    let pendingCount = 0;
    let overdueCount = 0;
    let paidCount = 0;
    let totalReceivable = 0;

    allInvoices.forEach((inv) => {
      const isOverdue =
        inv.paymentStatus === 'PENDING' &&
        inv.dueDate &&
        new Date(inv.dueDate) < now &&
        Number(inv.balanceAmount) > 0;

      if (inv.paymentStatus === 'PAID') {
        paidCount++;
      } else if (isOverdue) {
        overdueCount++;
        totalReceivable += Number(inv.balanceAmount);
      } else if (inv.paymentStatus === 'PENDING' || inv.paymentStatus === 'PARTIAL') {
        pendingCount++;
        totalReceivable += Number(inv.balanceAmount);
      }
    });

    return NextResponse.json({
      invoices: invoicesWithStatus,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total: allInvoices.length,
        pending: pendingCount,
        overdue: overdueCount,
        paid: paidCount,
        totalReceivable,
      },
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

// POST /api/sales-invoices - Create invoice from delivered sales order
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.salesOrderId) {
      return NextResponse.json(
        { error: 'Sales Order ID is required' },
        { status: 400 }
      );
    }

    // Get the sales order
    const salesOrder = await db.salesOrder.findUnique({
      where: { id: body.salesOrderId },
      include: {
        customer: true,
        items: {
          include: {
            item: true,
          },
        },
        invoice: true,
      },
    });

    if (!salesOrder) {
      return NextResponse.json(
        { error: 'Sales order not found' },
        { status: 404 }
      );
    }

    // Check if order is not rejected
    if (salesOrder.status === 'REJECTED') {
      return NextResponse.json(
        { error: 'Cannot create invoice for rejected orders' },
        { status: 400 }
      );
    }

    // Check if invoice already exists
    if (salesOrder.invoice) {
      return NextResponse.json(
        { error: 'Invoice already exists for this order', invoiceId: salesOrder.invoice.id },
        { status: 409 }
      );
    }

    // Validate stock availability using priority-based allocation
    const allocationResult = await calculateStockAllocation(db);
    const allocations = getOrderAllocation(salesOrder.id, allocationResult);
    const stockStatus = calculateOrderStockStatus(allocations);

    // Only allow invoice creation for fully allocated orders (In Stock)
    if (stockStatus !== 'Available') {
      const allocationMap = new Map(allocations.map((a) => [a.itemId, a]));

      const insufficientStockItems = salesOrder.items
        .map((orderItem) => {
          const allocation = allocationMap.get(orderItem.itemId);
          const allocatedQty = allocation?.allocatedQty || 0;
          const orderedQty = Number(orderItem.quantity);
          const shortfall = allocation?.shortfallQty || orderedQty;

          if (shortfall > 0) {
            return {
              itemCode: orderItem.item.itemCode,
              itemName: orderItem.item.name,
              required: orderedQty,
              available: allocatedQty,
              shortfall,
            };
          }
          return null;
        })
        .filter((item) => item !== null);

      return NextResponse.json(
        {
          error: stockStatus === 'Partial'
            ? 'Cannot create invoice: Order is partially allocated. Some items have insufficient stock based on priority allocation.'
            : 'Cannot create invoice: No stock allocated for this order. All items are out of stock or allocated to higher priority orders.',
          stockStatus,
          insufficientStock: insufficientStockItems,
        },
        { status: 400 }
      );
    }

    // Create invoice in transaction
    const invoice = await db.$transaction(async (tx) => {
      // Generate invoice number
      const invoiceNumber = await generateInvoiceNumber(tx as any);

      // Calculate GST breakdown
      const items = salesOrder.items.map((item) => ({
        amount: Number(item.amount),
        taxAmount: Number(item.taxAmount),
      }));
      const { subtotal, totalTax, cgst, sgst, totalAmount } = calculateOrderTotals(
        items,
        body.roundOff || 0
      );

      // Calculate due date
      const invoiceDate = body.invoiceDate ? new Date(body.invoiceDate) : new Date();
      const dueDate = calculateDueDate(invoiceDate, salesOrder.customer.creditDays);

      // Prepare invoice items from sales order items
      const invoiceItems = salesOrder.items.map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity,
        rate: item.rate,
        discountPercent: item.discountPercent,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        amount: item.amount,
      }));

      // Create the invoice with items
      const newInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          invoiceDate,
          orderNumber: salesOrder.orderNumber, // Store for reference
          customerId: salesOrder.customerId,
          subtotal,
          cgst,
          sgst,
          taxAmount: totalTax,
          roundOff: body.roundOff || 0,
          totalAmount,
          paidAmount: 0,
          balanceAmount: totalAmount,
          paymentStatus: 'PENDING',
          dueDate,
          notes: body.notes || salesOrder.notes,
          items: {
            create: invoiceItems,
          },
        },
        include: {
          customer: {
            select: {
              id: true,
              customerNumber: true,
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

      // Deduct stock and release reservations
      const itemIds = salesOrder.items.map((item) => item.itemId);
      const inventories = await tx.inventory.findMany({
        where: { itemId: { in: itemIds } },
      });
      const inventoryMap = new Map(inventories.map((inv) => [inv.itemId, inv]));

      const inventoryUpdates: Promise<any>[] = [];
      const stockMovements: any[] = [];

      for (const orderItem of salesOrder.items) {
        const inventory = inventoryMap.get(orderItem.itemId);

        if (inventory) {
          // Deduct physical stock and release reservation
          inventoryUpdates.push(
            tx.inventory.update({
              where: { itemId: orderItem.itemId },
              data: {
                physicalStock: {
                  decrement: Number(orderItem.quantity),
                },
                reservedQuantity: {
                  decrement: Number(orderItem.quantity),
                },
              },
            })
          );

          // Record stock movement
          stockMovements.push({
            inventoryId: inventory.id,
            itemId: orderItem.itemId,
            quantity: -Number(orderItem.quantity),
            type: 'SALE',
            referenceType: 'INVOICE',
            referenceId: newInvoice.id,
            notes: `Invoiced - ${invoiceNumber} (Order: ${salesOrder.orderNumber})`,
            createdBy: salesOrder.createdBy,
          });
        }
      }

      // Execute all inventory operations in parallel
      await Promise.all([
        ...inventoryUpdates,
        stockMovements.length > 0
          ? tx.stockMovement.createMany({ data: stockMovements })
          : Promise.resolve(),
      ]);

      // Create customer ledger entry (DEBIT - customer owes us)
      const lastLedgerEntry = await tx.customerLedger.findFirst({
        where: { customerId: salesOrder.customerId },
        orderBy: { date: 'desc' },
      });

      const previousBalance = lastLedgerEntry ? Number(lastLedgerEntry.balance) : 0;
      const newBalance = previousBalance + totalAmount;

      await tx.customerLedger.create({
        data: {
          customerId: salesOrder.customerId,
          date: invoiceDate,
          description: `Sales Invoice - ${invoiceNumber}`,
          type: 'SALES_INVOICE',
          debit: totalAmount,
          credit: 0,
          balance: newBalance,
          referenceType: 'sales_invoice',
          referenceId: newInvoice.id,
        },
      });

      // Delete the sales order (cascade will delete items and status history)
      await tx.salesOrder.delete({
        where: { id: salesOrder.id },
      });

      return newInvoice;
    }, {
      maxWait: 15000,
      timeout: 45000,
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating invoice:', error);

    const prismaError = error as { code?: string; message?: string };

    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Invoice number already exists' },
        { status: 409 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to create invoice';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
