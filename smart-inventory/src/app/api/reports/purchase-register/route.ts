import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const vendorId = searchParams.get('vendorId');

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59.999');

    const dateFilter = { gte: start, lte: end };
    const vendorFilter = vendorId ? { vendorId } : {};

    const invoices = await db.purchaseInvoice.findMany({
      where: { date: dateFilter, ...vendorFilter },
      select: { date: true, amount: true, taxAmount: true, totalAmount: true },
    });

    // Aggregate by "YYYY-M" key
    const monthlyGross: Record<string, number> = {};
    const monthlyTax: Record<string, number> = {};
    const monthlyNet: Record<string, number> = {};

    for (const inv of invoices) {
      const d = new Date(inv.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthlyGross[key] = (monthlyGross[key] || 0) + Number(inv.amount);
      monthlyTax[key] = (monthlyTax[key] || 0) + Number(inv.taxAmount);
      monthlyNet[key] = (monthlyNet[key] || 0) + Number(inv.totalAmount);
    }

    // Walk month by month from start to end
    const months: { month: string; grossAmount: number; taxAmount: number; netAmount: number }[] = [];
    let y = start.getFullYear();
    let m = start.getMonth();

    while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) {
      const key = `${y}-${m}`;
      months.push({
        month: MONTH_NAMES[m],
        grossAmount: monthlyGross[key] || 0,
        taxAmount: monthlyTax[key] || 0,
        netAmount: monthlyNet[key] || 0,
      });

      m++;
      if (m > 11) { m = 0; y++; }
    }

    const totals = months.reduce(
      (acc, row) => ({
        grossAmount: acc.grossAmount + row.grossAmount,
        taxAmount: acc.taxAmount + row.taxAmount,
        netAmount: acc.netAmount + row.netAmount,
      }),
      { grossAmount: 0, taxAmount: 0, netAmount: 0 }
    );

    return NextResponse.json({ months, totals });
  } catch (error) {
    console.error('Error fetching purchase register:', error);
    return NextResponse.json({ error: 'Failed to fetch purchase register' }, { status: 500 });
  }
}
