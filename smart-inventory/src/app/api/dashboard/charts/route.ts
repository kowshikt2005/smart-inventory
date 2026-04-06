import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuth } from '@/lib/api-auth';

// GET /api/dashboard/charts - Monthly sales/purchases/profit for last 6 months
export async function GET() {
  try {
    const { error } = await checkAuth();
    if (error) return error;

    const now = new Date();

    // Build 6-month windows
    const months = Array.from({ length: 6 }, (_, i) => {
      const offset = 5 - i;
      const year = new Date(now.getFullYear(), now.getMonth() - offset, 1).getFullYear();
      const month = new Date(now.getFullYear(), now.getMonth() - offset, 1).getMonth();
      return {
        label: new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        from: new Date(year, month, 1),
        to: new Date(year, month + 1, 0, 23, 59, 59, 999),
      };
    });

    const results = await Promise.all(
      months.map(async (m) => {
        const [salesAgg, purchasesAgg, receiptsAgg] = await Promise.all([
          db.invoice.aggregate({
            where: { paymentStatus: { not: 'CANCELLED' }, invoiceDate: { gte: m.from, lte: m.to } },
            _sum: { totalAmount: true },
            _count: true,
          }),
          db.purchaseInvoice.aggregate({
            where: { status: { not: 'CANCELLED' }, date: { gte: m.from, lte: m.to } },
            _sum: { totalAmount: true },
            _count: true,
          }),
          db.payment.aggregate({
            where: { paymentDate: { gte: m.from, lte: m.to } },
            _sum: { amount: true },
          }),
        ]);

        const sales = Number(salesAgg._sum.totalAmount || 0);
        const purchases = Number(purchasesAgg._sum.totalAmount || 0);
        const receipts = Number(receiptsAgg._sum.amount || 0);

        return {
          label: m.label,
          sales,
          purchases,
          profit: sales - purchases,
          receipts,
          salesCount: salesAgg._count,
          purchasesCount: purchasesAgg._count,
        };
      })
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error fetching dashboard charts:', error);
    return NextResponse.json({ error: 'Failed to fetch chart data' }, { status: 500 });
  }
}
