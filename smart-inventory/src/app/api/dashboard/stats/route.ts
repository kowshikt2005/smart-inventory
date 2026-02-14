import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/dashboard/stats - Get dashboard summary metrics
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    // Build date filter
    const dateFilter: Record<string, Date> = {};
    if (fromDate) {
      dateFilter.gte = new Date(fromDate);
    }
    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.lte = endDate;
    }

    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // Sales: sum of Invoice.totalAmount (excluding CANCELLED)
    const salesAgg = await db.invoice.aggregate({
      where: {
        paymentStatus: { not: 'CANCELLED' },
        ...(hasDateFilter ? { invoiceDate: dateFilter } : {}),
      },
      _sum: { totalAmount: true },
      _count: true,
    });

    // Purchases: sum of PurchaseInvoice.totalAmount (excluding CANCELLED)
    const purchasesAgg = await db.purchaseInvoice.aggregate({
      where: {
        status: { not: 'CANCELLED' },
        ...(hasDateFilter ? { date: dateFilter } : {}),
      },
      _sum: { totalAmount: true },
      _count: true,
    });

    // Receivables: sum of balanceAmount on unpaid invoices
    const receivablesAgg = await db.invoice.aggregate({
      where: {
        paymentStatus: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
        ...(hasDateFilter ? { invoiceDate: dateFilter } : {}),
      },
      _sum: { balanceAmount: true },
    });

    // Payables: sum of balanceAmount on unpaid purchase invoices
    const payablesAgg = await db.purchaseInvoice.aggregate({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
        ...(hasDateFilter ? { date: dateFilter } : {}),
      },
      _sum: { balanceAmount: true },
    });

    const totalSales = Number(salesAgg._sum.totalAmount || 0);
    const totalPurchases = Number(purchasesAgg._sum.totalAmount || 0);
    const totalReceivables = Number(receivablesAgg._sum.balanceAmount || 0);
    const totalPayables = Number(payablesAgg._sum.balanceAmount || 0);

    return NextResponse.json({
      totalSales,
      totalPurchases,
      totalReceivables,
      totalPayables,
      netProfit: totalSales - totalPurchases,
      salesCount: salesAgg._count,
      purchasesCount: purchasesAgg._count,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
}
