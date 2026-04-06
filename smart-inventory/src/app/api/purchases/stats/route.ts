import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';

// GET /api/purchases/stats - Get purchase module statistics
export async function GET() {
  try {
    const { error } = await checkPermission('dashboard', 'view');
    if (error) return error;
    // Get purchase order stats
    const [ordersTotal, ordersOpen, ordersPartial, ordersReceived] = await Promise.all([
      db.purchaseOrder.count(),
      db.purchaseOrder.count({ where: { status: 'OPEN' } }),
      db.purchaseOrder.count({ where: { status: 'PARTIAL' } }),
      db.purchaseOrder.count({ where: { status: 'RECEIVED' } }),
    ]);

    // Get purchase invoice stats
    const [invoicesTotal, invoicesPending, invoicesPaid, invoicesOverdue] = await Promise.all([
      db.purchaseInvoice.count(),
      db.purchaseInvoice.count({ where: { status: 'PENDING' } }),
      db.purchaseInvoice.count({ where: { status: 'PAID' } }),
      db.purchaseInvoice.count({ where: { status: 'OVERDUE' } }),
    ]);

    // Get vendor payment stats
    const [paymentsTotal, paymentsSum] = await Promise.all([
      db.vendorPayment.count(),
      db.vendorPayment.aggregate({
        _sum: {
          amount: true,
        },
      }),
    ]);

    // Get purchase return stats
    const [returnsTotal, returnsOpen, returnsCompleted] = await Promise.all([
      db.purchaseReturn.count(),
      db.purchaseReturn.count({ where: { status: 'OPEN' } }),
      db.purchaseReturn.count({ where: { status: 'COMPLETED' } }),
    ]);

    const stats = {
      orders: {
        total: ordersTotal,
        open: ordersOpen,
        partial: ordersPartial,
        received: ordersReceived,
      },
      invoices: {
        total: invoicesTotal,
        pending: invoicesPending,
        paid: invoicesPaid,
        overdue: invoicesOverdue,
      },
      payments: {
        total: paymentsTotal,
        amount: Number(paymentsSum._sum.amount) || 0,
      },
      returns: {
        total: returnsTotal,
        open: returnsOpen,
        completed: returnsCompleted,
      },
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching purchase stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase statistics' },
      { status: 500 }
    );
  }
}