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

    // Enrich entries with reference details
    const purchaseInvoiceIds: string[] = [];
    const vendorPaymentIds: string[] = [];
    const purchaseReturnIds: string[] = [];

    for (const entry of entries) {
      if (entry.referenceType === 'PURCHASE_INVOICE' && entry.referenceId) {
        purchaseInvoiceIds.push(entry.referenceId);
      } else if (entry.referenceType === 'PURCHASE_PAYMENT' && entry.referenceId) {
        vendorPaymentIds.push(entry.referenceId);
      } else if (entry.referenceType === 'PURCHASE_RETURN' && entry.referenceId) {
        purchaseReturnIds.push(entry.referenceId);
      }
    }

    const [purchaseInvoices, vendorPayments, purchaseReturns] = await Promise.all([
      purchaseInvoiceIds.length > 0
        ? db.purchaseInvoice.findMany({
            where: { id: { in: purchaseInvoiceIds } },
            select: { id: true, invoiceNumber: true },
          })
        : [],
      vendorPaymentIds.length > 0
        ? db.vendorPayment.findMany({
            where: { id: { in: vendorPaymentIds } },
            select: {
              id: true,
              paymentNumber: true,
              mode: true,
              paidFrom: true,
              bankAccount: {
                select: { id: true, accountName: true },
              },
            },
          })
        : [],
      purchaseReturnIds.length > 0
        ? db.purchaseReturn.findMany({
            where: { id: { in: purchaseReturnIds } },
            select: { id: true, returnNumber: true },
          })
        : [],
    ]);

    const piMap = new Map(purchaseInvoices.map((inv) => [inv.id, inv]));
    const vpMap = new Map(vendorPayments.map((p) => [p.id, p]));
    const prMap = new Map(purchaseReturns.map((r) => [r.id, r]));

    // Calculate running balances and enrich with reference details
    let runningBalance = openingBalance;
    const entriesWithBalance = entries.map((entry) => {
      // For vendor: credit increases balance (we owe more), debit decreases (we paid)
      runningBalance += Number(entry.credit) - Number(entry.debit);

      let referenceNumber: string | null = null;
      let referenceLink: string | null = null;
      let bankDetails: string | null = null;

      if (entry.referenceType === 'PURCHASE_INVOICE' && entry.referenceId) {
        const inv = piMap.get(entry.referenceId);
        if (inv) {
          referenceNumber = inv.invoiceNumber;
          referenceLink = `/purchases/invoices/${entry.referenceId}`;
        }
      } else if (entry.referenceType === 'PURCHASE_PAYMENT' && entry.referenceId) {
        const pmt = vpMap.get(entry.referenceId);
        if (pmt) {
          referenceNumber = pmt.paymentNumber;
          referenceLink = `/purchases/payments`;
          bankDetails = pmt.mode + (pmt.bankAccount ? ` - ${pmt.bankAccount.accountName}` : '');
        }
      } else if (entry.referenceType === 'PURCHASE_RETURN' && entry.referenceId) {
        const ret = prMap.get(entry.referenceId);
        if (ret) {
          referenceNumber = ret.returnNumber;
          referenceLink = `/purchases/returns/${entry.referenceId}`;
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
