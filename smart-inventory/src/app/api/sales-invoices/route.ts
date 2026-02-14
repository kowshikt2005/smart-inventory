import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { generateInvoiceNumber, calculateDueDate } from '@/lib/invoice-utils';
import { calculateOrderTotals } from '@/lib/order-utils';
import { calculateStockAllocation, getOrderAllocation, calculateOrderStockStatus } from '@/lib/stock-allocation';
import { auth } from '@/lib/auth';

// GET /api/sales-invoices - Get all invoices with filtering
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const customerId = searchParams.get('customerId') || '';
    const brandId = searchParams.get('brandId') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '15');
    const skip = (page - 1) * limit;

    await auth();

    // Build where clause
    const where: any = {};

    if (status && status !== 'ALL') {
      where.paymentStatus = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (brandId) {
      where.items = { some: { item: { brandId } } };
    }

    if (dateFrom || dateTo) {
      where.invoiceDate = {};
      if (dateFrom) where.invoiceDate.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.invoiceDate.lte = to;
      }
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
          salesReturns: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { invoiceDate: 'desc' },
      }),
      db.invoice.count({ where }),
    ]);

    // Filter out invoices with completed returns when fetching by customer
    // (typically used for creating new returns)
    const filteredInvoices = customerId
      ? invoices.filter((invoice: any) => {
          const hasCompletedReturn = invoice.salesReturns?.some(
            (ret: any) => ret.status === 'COMPLETED'
          );
          return !hasCompletedReturn;
        })
      : invoices;

    // Check for overdue invoices and update status
    const now = new Date();
    const invoicesWithStatus = filteredInvoices.map((invoice) => {
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

    // Calculate overall stats using database aggregation (much faster than fetching all)
    const [paidCount, overdueStats, pendingStats, totalCount] = await Promise.all([
      // Count paid invoices
      db.invoice.count({ where: { paymentStatus: 'PAID' } }),
      // Count and sum overdue (pending, past due date, has balance)
      db.invoice.aggregate({
        where: {
          paymentStatus: 'PENDING',
          dueDate: { lt: now },
          balanceAmount: { gt: 0 },
        },
        _count: true,
        _sum: { balanceAmount: true },
      }),
      // Count and sum pending/partial (not overdue)
      db.invoice.aggregate({
        where: {
          OR: [
            { paymentStatus: 'PARTIAL' },
            {
              paymentStatus: 'PENDING',
              OR: [
                { dueDate: { gte: now } },
                { dueDate: null },
                { balanceAmount: 0 },
              ],
            },
          ],
        },
        _count: true,
        _sum: { balanceAmount: true },
      }),
      // Total count
      db.invoice.count(),
    ]);

    const overdueCount = overdueStats._count;
    const pendingCount = pendingStats._count;
    const totalReceivable =
      Number(overdueStats._sum.balanceAmount || 0) +
      Number(pendingStats._sum.balanceAmount || 0);

    // Adjust total count if we filtered invoices
    const adjustedTotal = customerId ? invoicesWithStatus.length : total;

    return NextResponse.json({
      invoices: invoicesWithStatus,
      pagination: {
        page,
        limit,
        total: adjustedTotal,
        totalPages: Math.ceil(adjustedTotal / limit),
      },
      stats: {
        total: totalCount,
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
        invoices: true,
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
    if (salesOrder.invoices && salesOrder.invoices.length > 0) {
      return NextResponse.json(
        { error: 'Invoice already exists for this order', invoiceId: salesOrder.invoices[0].id },
        { status: 409 }
      );
    }

    // Check if negative billing is enabled
    const negativeBillingSetting = await db.appSetting.findUnique({
      where: { key: 'negative_billing' },
    });
    const negativeBillingEnabled = negativeBillingSetting?.value === 'true';

    // Validate stock availability using priority-based allocation (skip if negative billing is ON)
    if (!negativeBillingEnabled) {
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
    }

    // Create invoice in transaction
    const invoice = await transaction(async (tx) => {
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
          salesOrderId: salesOrder.id, // Link to sales order for duplicate detection
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
            quantity: Number(orderItem.quantity),
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
      // Use deleteMany instead of delete to handle race conditions gracefully
      // (if another request already deleted this order, deleteMany won't throw)
      await tx.salesOrder.deleteMany({
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
