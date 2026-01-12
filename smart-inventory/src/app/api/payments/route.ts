import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generatePaymentNumber } from '@/lib/invoice-utils';

// GET /api/payments - Get all payments with filtering
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const customerId = searchParams.get('customerId') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '15');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (customerId) {
      where.customerId = customerId;
    }

    if (search) {
      where.OR = [
        { paymentNumber: { contains: search } },
        { referenceNumber: { contains: search } },
        { customer: { name: { contains: search } } },
        { customer: { customerNumber: { contains: search } } },
      ];
    }

    // Get payments with relations
    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              customerNumber: true,
              name: true,
            },
          },
          allocations: {
            include: {
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  totalAmount: true,
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { paymentDate: 'desc' },
      }),
      db.payment.count({ where }),
    ]);

    return NextResponse.json({
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

// POST /api/payments - Create payment with allocations
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.customerId) {
      return NextResponse.json(
        { error: 'Customer is required' },
        { status: 400 }
      );
    }

    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { error: 'Valid payment amount is required' },
        { status: 400 }
      );
    }

    if (!body.paymentDate) {
      return NextResponse.json(
        { error: 'Payment date is required' },
        { status: 400 }
      );
    }

    if (!body.mode) {
      return NextResponse.json(
        { error: 'Payment mode is required' },
        { status: 400 }
      );
    }

    if (!body.allocations || !Array.isArray(body.allocations) || body.allocations.length === 0) {
      return NextResponse.json(
        { error: 'At least one invoice allocation is required' },
        { status: 400 }
      );
    }

    // Validate allocation sum equals payment amount
    const allocationSum = body.allocations.reduce(
      (sum: number, alloc: { amount: number }) => sum + alloc.amount,
      0
    );

    if (Math.abs(allocationSum - body.amount) > 0.01) {
      return NextResponse.json(
        { error: 'Total allocations must equal payment amount' },
        { status: 400 }
      );
    }

    // Validate customer exists
    const customer = await db.customer.findUnique({
      where: { id: body.customerId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Validate all invoices exist and belong to customer
    const invoiceIds = body.allocations.map((a: { invoiceId: string }) => a.invoiceId);
    const invoices = await db.invoice.findMany({
      where: {
        id: { in: invoiceIds },
        customerId: body.customerId,
      },
    });

    if (invoices.length !== invoiceIds.length) {
      return NextResponse.json(
        { error: 'One or more invoices not found or do not belong to this customer' },
        { status: 400 }
      );
    }

    // Validate no overpayment per invoice
    for (const allocation of body.allocations) {
      const invoice = invoices.find((i) => i.id === allocation.invoiceId);
      if (!invoice) continue;

      const balance = Number(invoice.balanceAmount);
      if (allocation.amount > balance + 0.01) {
        return NextResponse.json(
          {
            error: `Cannot allocate ${allocation.amount} to invoice ${invoice.invoiceNumber}. Balance is only ${balance}`,
          },
          { status: 400 }
        );
      }
    }

    // Create payment in transaction
    const payment = await db.$transaction(async (tx) => {
      // Generate payment number
      const paymentNumber = await generatePaymentNumber(tx as any);

      // Create payment
      const newPayment = await tx.payment.create({
        data: {
          paymentNumber,
          paymentDate: new Date(body.paymentDate),
          customerId: body.customerId,
          amount: body.amount,
          mode: body.mode,
          referenceNumber: body.referenceNumber || null,
          notes: body.notes || null,
        },
      });

      // Create allocations and update invoices
      for (const allocation of body.allocations) {
        // Create allocation record
        await tx.paymentAllocation.create({
          data: {
            paymentId: newPayment.id,
            invoiceId: allocation.invoiceId,
            amount: allocation.amount,
          },
        });

        // Update invoice
        const invoice = invoices.find((i) => i.id === allocation.invoiceId)!;
        const newPaidAmount = Number(invoice.paidAmount) + allocation.amount;
        const newBalanceAmount = Number(invoice.totalAmount) - newPaidAmount;

        let newStatus = invoice.paymentStatus;
        if (newBalanceAmount <= 0.01) {
          newStatus = 'PAID';
        } else if (newPaidAmount > 0) {
          newStatus = 'PARTIAL';
        }

        await tx.invoice.update({
          where: { id: allocation.invoiceId },
          data: {
            paidAmount: newPaidAmount,
            balanceAmount: Math.max(0, newBalanceAmount),
            paymentStatus: newStatus,
          },
        });
      }

      // Create customer ledger entry (CREDIT - reduces receivable)
      const lastLedgerEntry = await tx.customerLedger.findFirst({
        where: { customerId: body.customerId },
        orderBy: { date: 'desc' },
      });

      const previousBalance = lastLedgerEntry ? Number(lastLedgerEntry.balance) : 0;
      const newBalance = previousBalance - body.amount;

      await tx.customerLedger.create({
        data: {
          customerId: body.customerId,
          date: new Date(body.paymentDate),
          description: `Payment Received - ${paymentNumber}`,
          type: 'SALES_RECEIPT',
          debit: 0,
          credit: body.amount,
          balance: newBalance,
          referenceType: 'sales_receipt',
          referenceId: newPayment.id,
        },
      });

      return newPayment;
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    // Fetch complete payment with relations
    const completePayment = await db.payment.findUnique({
      where: { id: payment.id },
      include: {
        customer: {
          select: {
            id: true,
            customerNumber: true,
            name: true,
          },
        },
        allocations: {
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(completePayment, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating payment:', error);

    const prismaError = error as { code?: string; message?: string };

    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Payment number already exists' },
        { status: 409 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to create payment';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
