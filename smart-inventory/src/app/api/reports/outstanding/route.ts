import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (fromDate) {
      dateFilter.gte = new Date(fromDate);
    }
    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.lte = endDate;
    }

    // Fetch all invoices that still have a balance, excluding only PAID
    const invoices = await db.invoice.findMany({
      where: {
        balanceAmount: { gt: 0 },
        paymentStatus: { not: 'PAID' },
        ...(customerId ? { customerId } : {}),
        ...(Object.keys(dateFilter).length > 0 ? { invoiceDate: dateFilter } : {}),
      },
      include: {
        customer: {
          select: { id: true, name: true, creditDays: true },
        },
      },
      orderBy: { invoiceDate: 'desc' },
    });

    // Calculate effective due date and days overdue for each invoice
    const outstanding = invoices
      .map((inv) => {
        const invoiceDate = new Date(inv.invoiceDate);
        invoiceDate.setHours(0, 0, 0, 0);

        let effectiveDueDate: Date;
        if (inv.dueDate) {
          effectiveDueDate = new Date(inv.dueDate);
          effectiveDueDate.setHours(0, 0, 0, 0);
        } else {
          effectiveDueDate = new Date(
            invoiceDate.getTime() + inv.customer.creditDays * 24 * 60 * 60 * 1000
          );
        }

        const daysOverdue = Math.round(
          (today.getTime() - effectiveDueDate.getTime()) / (24 * 60 * 60 * 1000)
        );

        return {
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: invoiceDate.toISOString().split('T')[0],
          dueDate: effectiveDueDate.toISOString().split('T')[0],
          totalAmount: Number(inv.totalAmount),
          balanceAmount: Number(inv.balanceAmount),
          paidAmount: Number(inv.paidAmount),
          daysOverdue,
          status: inv.paymentStatus,
          customerId: inv.customer.id,
          customerName: inv.customer.name,
          creditDays: inv.customer.creditDays,
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    const uniqueCustomers = new Set(outstanding.map((inv) => inv.customerId));
    const summary = {
      totalCustomers: uniqueCustomers.size,
      totalInvoices: outstanding.length,
      totalOutstanding: outstanding.reduce((sum, inv) => sum + inv.balanceAmount, 0),
    };

    return NextResponse.json({ invoices: outstanding, summary });
  } catch (error) {
    console.error('Error fetching outstanding report:', error);
    return NextResponse.json({ error: 'Failed to fetch outstanding report' }, { status: 500 });
  }
}
