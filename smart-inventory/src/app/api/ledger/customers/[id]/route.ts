import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/ledger/customers/[id] - Get customer ledger entries
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Check customer exists
    const customer = await db.customer.findUnique({
      where: { id },
      select: {
        id: true,
        customerNumber: true,
        name: true,
        openingBalance: true,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Build where clause
    const where: any = { customerId: id };

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) {
        where.date.gte = new Date(fromDate);
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        where.date.lte = endDate;
      }
    }

    // Get ledger entries
    const [entries, total] = await Promise.all([
      db.customerLedger.findMany({
        where,
        orderBy: { date: 'asc' },
        skip,
        take: limit,
      }),
      db.customerLedger.count({ where }),
    ]);

    // Calculate opening balance for date range
    let openingBalance = Number(customer.openingBalance);

    if (fromDate) {
      // Sum all entries before fromDate
      const priorEntries = await db.customerLedger.aggregate({
        where: {
          customerId: id,
          date: { lt: new Date(fromDate) },
        },
        _sum: {
          debit: true,
          credit: true,
        },
      });

      const priorDebit = Number(priorEntries._sum.debit || 0);
      const priorCredit = Number(priorEntries._sum.credit || 0);
      openingBalance += priorDebit - priorCredit;
    }

    // Calculate running balances
    let runningBalance = openingBalance;
    const entriesWithBalance = entries.map((entry) => {
      runningBalance += Number(entry.debit) - Number(entry.credit);
      return {
        ...entry,
        runningBalance,
      };
    });

    // Calculate totals for the period
    const totals = await db.customerLedger.aggregate({
      where,
      _sum: {
        debit: true,
        credit: true,
      },
    });

    const totalDebit = Number(totals._sum.debit || 0);
    const totalCredit = Number(totals._sum.credit || 0);
    const closingBalance = openingBalance + totalDebit - totalCredit;

    return NextResponse.json({
      customer,
      entries: entriesWithBalance,
      summary: {
        openingBalance,
        totalDebit,
        totalCredit,
        closingBalance,
        balanceType: closingBalance >= 0 ? 'Dr' : 'Cr',
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching customer ledger:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer ledger' },
      { status: 500 }
    );
  }
}
