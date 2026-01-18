import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/ledger/vendors/[id] - Get vendor ledger entries
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

    // Check vendor exists
    const vendor = await db.vendor.findUnique({
      where: { id },
      select: {
        id: true,
        vendorNumber: true,
        name: true,
        openingBalance: true,
      },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    // Build where clause
    const where: any = { vendorId: id };

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
      db.vendorLedger.findMany({
        where,
        orderBy: { date: 'asc' },
        skip,
        take: limit,
      }),
      db.vendorLedger.count({ where }),
    ]);

    // Calculate opening balance for date range
    // For vendors: positive balance means we owe them (credit balance)
    let openingBalance = Number(vendor.openingBalance);

    if (fromDate) {
      // Sum all entries before fromDate
      const priorEntries = await db.vendorLedger.aggregate({
        where: {
          vendorId: id,
          date: { lt: new Date(fromDate) },
        },
        _sum: {
          debit: true,
          credit: true,
        },
      });

      const priorDebit = Number(priorEntries._sum.debit || 0);
      const priorCredit = Number(priorEntries._sum.credit || 0);
      // For vendor: credit increases what we owe, debit decreases
      openingBalance += priorCredit - priorDebit;
    }

    // Calculate running balances
    let runningBalance = openingBalance;
    const entriesWithBalance = entries.map((entry) => {
      // For vendor: credit increases balance (we owe more), debit decreases (we paid)
      runningBalance += Number(entry.credit) - Number(entry.debit);
      return {
        ...entry,
        runningBalance,
      };
    });

    // Calculate totals for the period
    const totals = await db.vendorLedger.aggregate({
      where,
      _sum: {
        debit: true,
        credit: true,
      },
    });

    const totalDebit = Number(totals._sum.debit || 0);
    const totalCredit = Number(totals._sum.credit || 0);
    // Closing balance: credit - debit for vendor ledger
    const closingBalance = openingBalance + totalCredit - totalDebit;

    return NextResponse.json({
      vendor,
      entries: entriesWithBalance,
      summary: {
        openingBalance,
        totalDebit,
        totalCredit,
        closingBalance,
        // Positive closing balance means we owe the vendor (Cr)
        // Negative means vendor owes us (Dr)
        balanceType: closingBalance >= 0 ? 'Cr' : 'Dr',
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching vendor ledger:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendor ledger' },
      { status: 500 }
    );
  }
}
