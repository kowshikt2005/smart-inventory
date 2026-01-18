import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/vendor-payments/[id] - Get a single vendor payment
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const vendorPayment = await db.vendorPayment.findUnique({
      where: { id },
      include: {
        vendor: {
          select: {
            id: true,
            vendorNumber: true,
            name: true,
            gstin: true,
            email: true,
            phone: true,
          },
        },
        purchaseInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            date: true,
            dueDate: true,
            totalAmount: true,
            paidAmount: true,
            balanceAmount: true,
            status: true,
          },
        },
      },
    });

    if (!vendorPayment) {
      return NextResponse.json(
        { error: 'Vendor payment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(vendorPayment);
  } catch (error) {
    console.error('Error fetching vendor payment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendor payment' },
      { status: 500 }
    );
  }
}

// DELETE /api/vendor-payments/[id] - Delete a vendor payment
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Find existing payment
    const existingPayment = await db.vendorPayment.findUnique({
      where: { id },
      include: {
        purchaseInvoice: true,
        vendor: true,
      },
    });

    if (!existingPayment) {
      return NextResponse.json(
        { error: 'Vendor payment not found' },
        { status: 404 }
      );
    }

    // Delete payment and reverse changes in a transaction
    await db.$transaction(async (tx) => {
      const paymentAmount = Number(existingPayment.amount);

      // Update invoice paid amount and status
      const invoice = existingPayment.purchaseInvoice;
      const newPaidAmount = Number(invoice.paidAmount) - paymentAmount;
      const newBalanceAmount = Number(invoice.totalAmount) - newPaidAmount;

      // Determine new status
      let newStatus = invoice.status;
      if (invoice.status === 'PAID') {
        // Check if invoice is overdue
        const now = new Date();
        if (invoice.dueDate && new Date(invoice.dueDate) < now) {
          newStatus = 'OVERDUE';
        } else {
          newStatus = 'PENDING';
        }
      }

      await tx.purchaseInvoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaidAmount,
          balanceAmount: newBalanceAmount,
          status: newStatus,
        },
      });

      // Restore bank account balance if not cash
      if (existingPayment.paidFrom !== 'Cash') {
        await tx.bankAccount.update({
          where: { id: existingPayment.paidFrom },
          data: {
            balance: {
              increment: paymentAmount,
            },
          },
        });
      }

      // Delete the ledger entry
      await tx.vendorLedger.deleteMany({
        where: {
          referenceType: 'vendor_payment',
          referenceId: id,
        },
      });

      // Recalculate subsequent ledger balances
      const remainingEntries = await tx.vendorLedger.findMany({
        where: { vendorId: existingPayment.vendorId },
        orderBy: { createdAt: 'asc' },
      });

      let runningBalance = Number(existingPayment.vendor.openingBalance);

      for (const entry of remainingEntries) {
        runningBalance = runningBalance + Number(entry.credit) - Number(entry.debit);
        await tx.vendorLedger.update({
          where: { id: entry.id },
          data: { balance: runningBalance },
        });
      }

      // Delete the payment
      await tx.vendorPayment.delete({
        where: { id },
      });
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    return NextResponse.json({ message: 'Vendor payment deleted successfully' });
  } catch (error: unknown) {
    console.error('Error deleting vendor payment:', error);

    const prismaError = error as { code?: string };

    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        { error: 'Vendor payment not found' },
        { status: 404 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to delete vendor payment';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
