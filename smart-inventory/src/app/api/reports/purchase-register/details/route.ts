import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    const { error } = await checkPermission('reports', 'view');
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // 0-11
    const year = searchParams.get('year');
    const vendorId = searchParams.get('vendorId');

    if (!month || !year) {
      return NextResponse.json({ error: 'month and year are required' }, { status: 400 });
    }

    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);

    // Calculate start and end of the month
    const startDate = new Date(yearNum, monthNum, 1);
    const endDate = new Date(yearNum, monthNum + 1, 0, 23, 59, 59, 999);

    const dateFilter = { gte: startDate, lte: endDate };
    const vendorFilter = vendorId && vendorId !== 'all' ? { vendorId } : {};

    // Fetch invoices, payments, and returns for the month
    const [invoices, payments, returns] = await Promise.all([
      db.purchaseInvoice.findMany({
        where: { date: dateFilter, ...vendorFilter },
        include: {
          vendor: { select: { id: true, name: true, vendorNumber: true } },
          items: {
            include: {
              item: { select: { name: true, itemCode: true, unit: true } },
            },
          },
        },
        orderBy: { date: 'asc' },
      }),
      db.vendorPayment.findMany({
        where: { date: dateFilter, ...vendorFilter },
        include: {
          vendor: { select: { id: true, name: true, vendorNumber: true } },
        },
        orderBy: { date: 'asc' },
      }),
      db.purchaseReturn.findMany({
        where: { date: dateFilter, status: 'COMPLETED', ...vendorFilter },
        include: {
          vendor: { select: { id: true, name: true, vendorNumber: true } },
        },
        orderBy: { date: 'asc' },
      }),
    ]);

    // Format the data
    const formattedInvoices = invoices.map(inv => ({
      id: inv.id,
      type: 'INVOICE' as const,
      number: inv.invoiceNumber,
      date: inv.date.toISOString().split('T')[0],
      vendorName: inv.vendor.name,
      vendorId: inv.vendor.id,
      amount: Number(inv.totalAmount),
      paidAmount: Number(inv.paidAmount),
      balanceAmount: Number(inv.balanceAmount),
      status: inv.status,
      taxableAmount: Number(inv.amount),
      taxAmount: Number(inv.taxAmount),
      roundOff: 0, // PurchaseInvoice doesn't have roundOff field
      items: inv.items.map(item => ({
        id: item.id,
        itemName: item.item.name,
        itemCode: item.item.itemCode,
        quantity: Number(item.quantity),
        rate: Number(item.rate),
        amount: Number(item.amount),
        unit: item.item.unit,
        taxRate: Number(item.taxRate),
        taxAmount: Number(item.taxAmount),
      })),
    }));

    const formattedPayments = payments.map(pay => ({
      id: pay.id,
      type: 'PAYMENT' as const,
      number: pay.paymentNumber,
      date: pay.date.toISOString().split('T')[0],
      vendorName: pay.vendor.name,
      vendorId: pay.vendor.id,
      amount: Number(pay.amount),
      mode: pay.mode,
      reference: pay.reference,
    }));

    const formattedReturns = returns.map(ret => ({
      id: ret.id,
      type: 'RETURN' as const,
      number: ret.returnNumber,
      date: ret.date.toISOString().split('T')[0],
      vendorName: ret.vendor.name,
      vendorId: ret.vendor.id,
      amount: Number(ret.totalAmount),
      status: ret.status,
    }));

    // Calculate totals
    const totalInvoices = formattedInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const totalPayments = formattedPayments.reduce((sum, pay) => sum + pay.amount, 0);
    const totalReturns = formattedReturns.reduce((sum, ret) => sum + ret.amount, 0);

    return NextResponse.json({
      invoices: formattedInvoices,
      payments: formattedPayments,
      returns: formattedReturns,
      summary: {
        totalInvoices,
        totalPayments,
        totalReturns,
        credit: totalInvoices,
        debit: totalPayments + totalReturns,
        balance: totalInvoices - totalPayments - totalReturns,
      },
    });
  } catch (error) {
    console.error('Error fetching purchase register details:', error);
    return NextResponse.json({ error: 'Failed to fetch details' }, { status: 500 });
  }
}
