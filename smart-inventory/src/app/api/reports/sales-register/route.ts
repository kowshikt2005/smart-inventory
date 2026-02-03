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
    const customerId = searchParams.get('customerId');

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59.999');

    const dateFilter = { gte: start, lte: end };
    const customerFilter = customerId ? { customerId } : {};

    // Credit = invoices, Debit = payments + completed returns — all in parallel
    const [invoices, payments, returns] = await Promise.all([
      db.invoice.findMany({
        where: { invoiceDate: dateFilter, ...customerFilter },
        select: { invoiceDate: true, totalAmount: true },
      }),
      db.payment.findMany({
        where: { paymentDate: dateFilter, ...customerFilter },
        select: { paymentDate: true, amount: true },
      }),
      db.salesReturn.findMany({
        where: { returnDate: dateFilter, status: 'COMPLETED', ...customerFilter },
        select: { returnDate: true, totalAmount: true },
      }),
    ]);

    // Aggregate by "YYYY-M" key
    const monthlyDebit: Record<string, number> = {};
    const monthlyCredit: Record<string, number> = {};

    for (const inv of invoices) {
      const d = new Date(inv.invoiceDate);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthlyCredit[key] = (monthlyCredit[key] || 0) + Number(inv.totalAmount);
    }

    for (const pay of payments) {
      const d = new Date(pay.paymentDate);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthlyDebit[key] = (monthlyDebit[key] || 0) + Number(pay.amount);
    }

    for (const ret of returns) {
      const d = new Date(ret.returnDate);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthlyDebit[key] = (monthlyDebit[key] || 0) + Number(ret.totalAmount);
    }

    // Walk month by month from start to end
    const months: { month: string; debit: number; credit: number; balance: number }[] = [];
    let y = start.getFullYear();
    let m = start.getMonth();

    while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) {
      const key = `${y}-${m}`;
      const debit = monthlyDebit[key] || 0;
      const credit = monthlyCredit[key] || 0;

      months.push({
        month: MONTH_NAMES[m],
        debit,
        credit,
        balance: credit - debit,
      });

      m++;
      if (m > 11) { m = 0; y++; }
    }

    const totals = months.reduce(
      (acc, row) => ({
        debit: acc.debit + row.debit,
        credit: acc.credit + row.credit,
        balance: acc.balance + row.balance,
      }),
      { debit: 0, credit: 0, balance: 0 }
    );

    return NextResponse.json({ months, totals });
  } catch (error) {
    console.error('Error fetching sales register:', error);
    return NextResponse.json({ error: 'Failed to fetch sales register' }, { status: 500 });
  }
}
