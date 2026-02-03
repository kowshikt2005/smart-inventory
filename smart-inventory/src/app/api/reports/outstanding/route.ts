import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch all invoices that still have a balance, excluding paid/cancelled
    const invoices = await db.invoice.findMany({
      where: {
        balanceAmount: { gt: 0 },
        paymentStatus: { notIn: ['PAID', 'CANCELLED'] },
        ...(customerId ? { customerId } : {}),
      },
      include: {
        customer: {
          select: { id: true, name: true, creditDays: true },
        },
      },
      orderBy: { invoiceDate: 'asc' },
    });

    // Calculate effective due date per invoice, keep only overdue ones
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
          daysOverdue,
          customerId: inv.customer.id,
          customerName: inv.customer.name,
          creditDays: inv.customer.creditDays,
        };
      })
      .filter((inv) => inv.daysOverdue > 0)
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
