import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { PaymentStatus } from '@/generated/prisma';
import { checkPermission } from '@/lib/api-auth';

// GET /api/payments/[id] - Get single payment
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('sales_receipts', 'view');
    if (error) return error;
    const { id } = await params;

    const payment = await db.payment.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            customerNumber: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        allocations: {
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                invoiceDate: true,
                totalAmount: true,
                paidAmount: true,
                balanceAmount: true,
                paymentStatus: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(payment);
  } catch (error) {
    console.error('Error fetching payment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment' },
      { status: 500 }
    );
  }
}

// DELETE /api/payments/[id] - Reverse/delete payment
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('sales_receipts', 'edit');
    if (error) return error;
    const { id } = await params;

    const payment = await db.payment.findUnique({
      where: { id },
      include: {
        allocations: {
          include: {
            invoice: true,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Reverse payment in transaction
    await transaction(async (tx) => {
      // Reverse each invoice allocation
      for (const allocation of payment.allocations) {
        const invoice = allocation.invoice;
        const newPaidAmount = Math.max(0, Number(invoice.paidAmount) - Number(allocation.amount));
        const newBalanceAmount = Number(invoice.totalAmount) - newPaidAmount;

        // Determine new status
        let newStatus: PaymentStatus = PaymentStatus.PENDING;
        if (newBalanceAmount <= 0.01) {
          newStatus = PaymentStatus.PAID;
        } else if (newPaidAmount > 0) {
          newStatus = PaymentStatus.PARTIAL;
        } else {
          // Check if overdue
          if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) {
            newStatus = PaymentStatus.OVERDUE;
          }
        }

        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: newPaidAmount,
            balanceAmount: newBalanceAmount,
            paymentStatus: newStatus,
          },
        });
      }

      // Create reversal ledger entry
      const lastLedgerEntry = await tx.customerLedger.findFirst({
        where: { customerId: payment.customerId },
        orderBy: { date: 'desc' },
      });

      const previousBalance = lastLedgerEntry ? Number(lastLedgerEntry.balance) : 0;
      const newBalance = previousBalance + Number(payment.amount);

      await tx.customerLedger.create({
        data: {
          customerId: payment.customerId,
          date: new Date(),
          description: `Payment Reversed - ${payment.paymentNumber}`,
          type: 'ADJUSTMENT',
          debit: Number(payment.amount),
          credit: 0,
          balance: newBalance,
          referenceType: 'sales_receipt',
          referenceId: payment.id,
        },
      });

      // Bank ledger reversal
      if (payment.bankAccountId) {
        await tx.bankLedger.create({
          data: {
            bankAccountId: payment.bankAccountId,
            date: new Date(),
            description: `Reversed Sales Receipt ${payment.paymentNumber}`,
            type: 'ADJUSTMENT',
            debit: Number(payment.amount),
            credit: 0,
            balance: 0, // Will be recalculated
            referenceType: 'sales_receipt',
            referenceId: payment.id,
          },
        });

        await tx.bankAccount.update({
          where: { id: payment.bankAccountId },
          data: { currentBalance: { decrement: Number(payment.amount) } },
        });
      }

      // Delete allocations (cascade should handle this, but explicit)
      await tx.paymentAllocation.deleteMany({
        where: { paymentId: id },
      });

      // Delete payment
      await tx.payment.delete({
        where: { id },
      });
    });

    return NextResponse.json({ message: 'Payment reversed successfully' });
  } catch (error) {
    console.error('Error reversing payment:', error);
    return NextResponse.json(
      { error: 'Failed to reverse payment' },
      { status: 500 }
    );
  }
}
