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

    // Get ledger entries - sort by createdAt for pure chronological order (date + time)
    const [entries, total] = await Promise.all([
      db.customerLedger.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      db.customerLedger.count({ where }),
    ]);

    // Enrich entries with reference details
    const invoiceIds: string[] = [];
    const paymentIds: string[] = [];
    const returnIds: string[] = [];

    for (const entry of entries) {
      if (entry.referenceType === 'SALES_INVOICE' && entry.referenceId) {
        invoiceIds.push(entry.referenceId);
      } else if (entry.referenceType === 'SALES_RECEIPT' && entry.referenceId) {
        paymentIds.push(entry.referenceId);
      } else if (entry.referenceType === 'SALES_RETURN' && entry.referenceId) {
        returnIds.push(entry.referenceId);
      }
    }

    // Batch fetch referenced documents
    const [invoices, payments, returns] = await Promise.all([
      invoiceIds.length > 0
        ? db.invoice.findMany({
            where: { id: { in: invoiceIds } },
            select: { id: true, invoiceNumber: true },
          })
        : [],
      paymentIds.length > 0
        ? db.payment.findMany({
            where: { id: { in: paymentIds } },
            select: {
              id: true,
              paymentNumber: true,
              mode: true,
              bankAccount: {
                select: { id: true, accountName: true },
              },
            },
          })
        : [],
      returnIds.length > 0
        ? db.salesReturn.findMany({
            where: { id: { in: returnIds } },
            select: { id: true, returnNumber: true },
          })
        : [],
    ]);

    // Build lookup maps
    const invoiceMap = new Map(invoices.map((inv) => [inv.id, inv]));
    const paymentMap = new Map(payments.map((p) => [p.id, p]));
    const returnMap = new Map(returns.map((r) => [r.id, r]));

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

    // Calculate running balances and enrich with reference details
    let runningBalance = openingBalance;
    const entriesWithBalance = entries.map((entry) => {
      runningBalance += Number(entry.debit) - Number(entry.credit);

      let referenceNumber: string | null = null;
      let referenceLink: string | null = null;
      let bankDetails: string | null = null;

      if (entry.referenceType === 'SALES_INVOICE' && entry.referenceId) {
        const inv = invoiceMap.get(entry.referenceId);
        if (inv) {
          referenceNumber = inv.invoiceNumber;
          referenceLink = `/sales/invoices/${entry.referenceId}`;
        }
      } else if (entry.referenceType === 'SALES_RECEIPT' && entry.referenceId) {
        const pmt = paymentMap.get(entry.referenceId);
        if (pmt) {
          referenceNumber = pmt.paymentNumber;
          referenceLink = `/sales/payments`;
          bankDetails = pmt.mode + (pmt.bankAccount ? ` - ${pmt.bankAccount.accountName}` : '');
        }
      } else if (entry.referenceType === 'SALES_RETURN' && entry.referenceId) {
        const ret = returnMap.get(entry.referenceId);
        if (ret) {
          referenceNumber = ret.returnNumber;
          referenceLink = `/sales/returns`;
        }
      }

      return {
        ...entry,
        runningBalance,
        referenceNumber,
        referenceLink,
        bankDetails,
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
