import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { generateVendorPaymentNumber } from '@/lib/purchase-utils';
import { checkPermission } from '@/lib/api-auth';

// GET /api/vendor-payments - Get all vendor payments with filtering
export async function GET(request: Request) {
  try {
    const { error } = await checkPermission('purchases_payments', 'view');
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const vendorId = searchParams.get('vendorId') || '';
    const purchaseInvoiceId = searchParams.get('purchaseInvoiceId') || '';
    const type = searchParams.get('type') || ''; // 'advance' or 'invoice'
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '15');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (vendorId) {
      where.vendorId = vendorId;
    }

    if (purchaseInvoiceId) {
      where.purchaseInvoiceId = purchaseInvoiceId;
    }

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.date.lte = to;
      }
    }

    // Filter by payment type
    if (type === 'advance') {
      where.purchaseInvoiceId = null;
    } else if (type === 'invoice') {
      where.purchaseInvoiceId = { not: null };
    }

    if (search) {
      where.OR = [
        { paymentNumber: { contains: search } },
        { reference: { contains: search } },
        { vendor: { name: { contains: search } } },
        { vendor: { vendorNumber: { contains: search } } },
        { purchaseInvoice: { invoiceNumber: { contains: search } } },
      ];
    }

    // Get vendor payments with relations
    const [vendorPayments, total] = await Promise.all([
      db.vendorPayment.findMany({
        where,
        include: {
          vendor: {
            select: {
              id: true,
              vendorNumber: true,
              name: true,
            },
          },
          purchaseInvoice: {
            select: {
              id: true,
              invoiceNumber: true,
              totalAmount: true,
              paidAmount: true,
              balanceAmount: true,
              status: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      db.vendorPayment.count({ where }),
    ]);

    return NextResponse.json({
      vendorPayments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching vendor payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendor payments' },
      { status: 500 }
    );
  }
}

// POST /api/vendor-payments - Create a new vendor payment
export async function POST(request: Request) {
  try {
    const { error } = await checkPermission('purchases_payments', 'edit');
    if (error) return error;

    const body = await request.json();

    // Validate required fields
    if (!body.vendorId) {
      return NextResponse.json(
        { error: 'Vendor is required' },
        { status: 400 }
      );
    }

    if (!body.date) {
      return NextResponse.json(
        { error: 'Payment date is required' },
        { status: 400 }
      );
    }

    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    if (!body.mode) {
      return NextResponse.json(
        { error: 'Payment mode is required' },
        { status: 400 }
      );
    }

    if (!body.paidFrom) {
      return NextResponse.json(
        { error: 'Payment source (Cash/Bank) is required' },
        { status: 400 }
      );
    }

    // Validate payment date is not in the future
    const paymentDate = new Date(body.date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (paymentDate > today) {
      return NextResponse.json(
        { error: 'Payment date cannot be in the future' },
        { status: 400 }
      );
    }

    // Validate vendor exists
    const vendor = await db.vendor.findUnique({
      where: { id: body.vendorId },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    // Check if this is an advance payment or invoice payment
    const isAdvancePayment = !body.purchaseInvoiceId;
    let purchaseInvoice = null;

    // If invoice payment, validate the invoice
    if (!isAdvancePayment) {
      purchaseInvoice = await db.purchaseInvoice.findUnique({
        where: { id: body.purchaseInvoiceId },
      });

      if (!purchaseInvoice) {
        return NextResponse.json(
          { error: 'Purchase invoice not found' },
          { status: 404 }
        );
      }

      if (purchaseInvoice.vendorId !== body.vendorId) {
        return NextResponse.json(
          { error: 'Purchase invoice belongs to a different vendor' },
          { status: 400 }
        );
      }

      if (purchaseInvoice.status === 'PAID') {
        return NextResponse.json(
          { error: 'Invoice is already fully paid' },
          { status: 400 }
        );
      }

      if (purchaseInvoice.status === 'CANCELLED') {
        return NextResponse.json(
          { error: 'Cannot make payment for cancelled invoice' },
          { status: 400 }
        );
      }

      // Validate payment amount doesn't exceed balance
      const balanceAmount = Number(purchaseInvoice.balanceAmount);
      if (body.amount > balanceAmount) {
        return NextResponse.json(
          { error: `Payment amount cannot exceed balance of ${balanceAmount.toFixed(2)}` },
          { status: 400 }
        );
      }
    }

    // Validate bank account if not cash
    if (body.paidFrom !== 'Cash') {
      const bankAccount = await db.bankAccount.findUnique({
        where: { id: body.paidFrom },
      });

      if (!bankAccount) {
        return NextResponse.json(
          { error: 'Bank account not found' },
          { status: 404 }
        );
      }

      if (!bankAccount.isActive) {
        return NextResponse.json(
          { error: 'Bank account is not active' },
          { status: 400 }
        );
      }

      // Check bank has sufficient balance
      if (Number(bankAccount.currentBalance) < body.amount) {
        return NextResponse.json(
          { error: 'Insufficient bank balance' },
          { status: 400 }
        );
      }
    }

    // Create payment in a transaction
    const vendorPayment = await transaction(async (tx) => {
      // Generate payment number
      const paymentNumber = await generateVendorPaymentNumber(tx as any);

      // Determine bankAccountId from paidFrom
      const bankAccountId = body.paidFrom !== 'Cash' ? body.paidFrom : null;

      // Create the payment
      const payment = await tx.vendorPayment.create({
        data: {
          paymentNumber,
          vendorId: body.vendorId,
          purchaseInvoiceId: body.purchaseInvoiceId || null,
          date: new Date(body.date),
          amount: body.amount,
          mode: body.mode,
          paidFrom: body.paidFrom,
          bankAccountId,
          chequeCollected: body.chequeCollected || false,
          chequeCollectedDate: body.chequeCollectedDate ? new Date(body.chequeCollectedDate) : null,
          reference: body.reference || null,
          notes: body.notes || null,
        },
        include: {
          vendor: {
            select: {
              id: true,
              vendorNumber: true,
              name: true,
            },
          },
          purchaseInvoice: {
            select: {
              id: true,
              invoiceNumber: true,
            },
          },
        },
      });

      // If invoice payment, update invoice paid amount and status
      if (purchaseInvoice) {
        const newPaidAmount = Number(purchaseInvoice.paidAmount) + body.amount;
        const newBalanceAmount = Number(purchaseInvoice.totalAmount) - newPaidAmount;
        const newStatus = newBalanceAmount <= 0 ? 'PAID' : purchaseInvoice.status;

        await tx.purchaseInvoice.update({
          where: { id: body.purchaseInvoiceId },
          data: {
            paidAmount: newPaidAmount,
            balanceAmount: newBalanceAmount,
            status: newStatus,
          },
        });
      }

      // Update bank account balance and create bank ledger entry if not cash
      if (bankAccountId) {
        const bankAcct = await tx.bankAccount.findUnique({
          where: { id: bankAccountId },
        });

        if (bankAcct) {
          const newBankBalance = Number(bankAcct.currentBalance) - body.amount;

          await tx.bankLedger.create({
            data: {
              bankAccountId,
              date: new Date(body.date),
              description: `Vendor Payment ${paymentNumber} to ${vendor.name}`,
              type: 'PURCHASE_PAYMENT',
              debit: body.amount,
              credit: 0,
              balance: newBankBalance,
              referenceType: 'vendor_payment',
              referenceId: payment.id,
            },
          });

          await tx.bankAccount.update({
            where: { id: bankAccountId },
            data: {
              currentBalance: {
                decrement: body.amount,
              },
            },
          });
        }
      }

      // Get the last ledger entry for this vendor to calculate running balance
      const lastLedgerEntry = await tx.vendorLedger.findFirst({
        where: { vendorId: body.vendorId },
        orderBy: { createdAt: 'desc' },
      });

      const previousBalance = lastLedgerEntry ? Number(lastLedgerEntry.balance) : Number(vendor.openingBalance);
      // Payment decreases what we owe to vendor (debit to vendor = we owe less)
      const newBalance = previousBalance - body.amount;

      // Create vendor ledger entry
      const description = isAdvancePayment
        ? `Advance Payment ${paymentNumber}`
        : `Payment ${paymentNumber} for Invoice ${purchaseInvoice!.invoiceNumber}`;

      await tx.vendorLedger.create({
        data: {
          vendorId: body.vendorId,
          date: new Date(body.date),
          description,
          type: 'PURCHASE_PAYMENT',
          debit: body.amount, // Debit means we paid the vendor
          credit: 0,
          balance: newBalance,
          referenceType: 'vendor_payment',
          referenceId: payment.id,
        },
      });

      return payment;
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    return NextResponse.json(vendorPayment, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating vendor payment:', error);

    const prismaError = error as { code?: string; message?: string };

    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Payment number already exists' },
        { status: 409 }
      );
    }

    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        { error: 'Related record not found.' },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to create vendor payment';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
