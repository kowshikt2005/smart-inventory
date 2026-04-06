import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';

// GET /api/ledger/bank-accounts/[id] - Get bank account ledger entries
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('bank_ledger', 'view');
    if (error) return error;

    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Check bank account exists
    const bankAccount = await db.bankAccount.findUnique({
      where: { id },
      select: {
        id: true,
        accountName: true,
        accountNumber: true,
        bankName: true,
        accountType: true,
        openingBalance: true,
        currentBalance: true,
      },
    });

    if (!bankAccount) {
      return NextResponse.json(
        { error: 'Bank account not found' },
        { status: 404 }
      );
    }

    // Build where clause
    const where: any = { bankAccountId: id };

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
      db.bankLedger.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      db.bankLedger.count({ where }),
    ]);

    // Calculate opening balance for date range
    let openingBalance = Number(bankAccount.openingBalance);

    if (fromDate) {
      // Sum all entries before fromDate
      const priorEntries = await db.bankLedger.aggregate({
        where: {
          bankAccountId: id,
          date: { lt: new Date(fromDate) },
        },
        _sum: {
          debit: true,
          credit: true,
        },
      });

      const priorDebit = Number(priorEntries._sum.debit || 0);
      const priorCredit = Number(priorEntries._sum.credit || 0);
      // For bank: credit increases balance, debit decreases
      openingBalance += priorCredit - priorDebit;
    }

    // Calculate running balances
    let runningBalance = openingBalance;
    const entriesWithBalance = entries.map((entry) => {
      runningBalance += Number(entry.credit) - Number(entry.debit);
      return {
        ...entry,
        runningBalance,
      };
    });

    // Calculate totals for the period
    const totals = await db.bankLedger.aggregate({
      where,
      _sum: {
        debit: true,
        credit: true,
      },
    });

    const totalDebit = Number(totals._sum.debit || 0);
    const totalCredit = Number(totals._sum.credit || 0);
    const closingBalance = openingBalance + totalCredit - totalDebit;

    return NextResponse.json({
      bankAccount,
      entries: entriesWithBalance,
      summary: {
        openingBalance,
        totalDebit,
        totalCredit,
        closingBalance,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching bank ledger:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bank ledger' },
      { status: 500 }
    );
  }
}
