import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateInvoiceNumber, calculateDueDate } from '@/lib/invoice-utils';
import { calculateOrderTotals } from '@/lib/order-utils';

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
        { salesOrder: { orderNumber: { contains: search } } },
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
          salesOrder: {
            select: {
              id: true,
              orderNumber: true,
              orderDate: true,
              items: {
                include: {
                  item: {
                    select: {
                      id: true,
                      itemCode: true,
                      name: true,
                      unit: true,
                      hsnCode: true,
                    },
                  },
                },
              },
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

    // Check if order is delivered
    if (salesOrder.status !== 'DELIVERED') {
      return NextResponse.json(
        { error: 'Only delivered orders can be invoiced' },
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

      // Create the invoice
      const newInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          invoiceDate,
          salesOrderId: salesOrder.id,
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
        },
        include: {
          customer: {
            select: {
              id: true,
              customerNumber: true,
              name: true,
            },
          },
          salesOrder: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
        },
      });

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

      return newInvoice;
    }, {
      maxWait: 10000,
      timeout: 30000,
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
