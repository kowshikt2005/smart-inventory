import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';

// GET /api/customers/[id]/pending-invoices - Get pending/overdue invoices for customer
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('masters_customers', 'view');
    if (error) return error;
    const { id } = await params;

    // Check customer exists
    const customer = await db.customer.findUnique({
      where: { id },
      select: { id: true, name: true, customerNumber: true },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Get all non-paid, non-cancelled invoices
    const invoices = await db.invoice.findMany({
      where: {
        customerId: id,
        paymentStatus: {
          in: ['PENDING', 'PARTIAL', 'OVERDUE'],
        },
        balanceAmount: {
          gt: 0,
        },
      },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        orderNumber: true,
        dueDate: true,
        totalAmount: true,
        paidAmount: true,
        balanceAmount: true,
        paymentStatus: true,
      },
      orderBy: { invoiceDate: 'asc' },
    });

    // Check for overdue status
    const now = new Date();
    const invoicesWithStatus = invoices.map((invoice) => {
      let effectiveStatus = invoice.paymentStatus;
      if (
        invoice.paymentStatus === 'PENDING' &&
        invoice.dueDate &&
        new Date(invoice.dueDate) < now
      ) {
        effectiveStatus = 'OVERDUE';
      }
      return {
        ...invoice,
        effectiveStatus,
      };
    });

    return NextResponse.json({
      customer,
      invoices: invoicesWithStatus,
    });
  } catch (error) {
    console.error('Error fetching pending invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending invoices' },
      { status: 500 }
    );
  }
}
