import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuth } from '@/lib/api-auth';

// GET /api/dashboard/activity
export async function GET() {
  try {
    const { error } = await checkAuth();
    if (error) return error;

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [invoices, payments, purchaseInvoices, stockMovements, salesOrders, scanSetting] =
      await Promise.all([
        db.invoice.findMany({
          take: 6, orderBy: { createdAt: 'desc' }, where: { createdAt: { gte: since } },
          select: {
            id: true, invoiceNumber: true, totalAmount: true, taxAmount: true,
            paymentStatus: true, invoiceDate: true, createdAt: true,
            customer: { select: { name: true } }, customerName: true,
          },
        }),
        db.payment.findMany({
          take: 5, orderBy: { createdAt: 'desc' }, where: { createdAt: { gte: since } },
          select: {
            id: true, paymentNumber: true, amount: true, mode: true,
            paymentDate: true, createdAt: true,
            customer: { select: { name: true } },
          },
        }),
        db.purchaseInvoice.findMany({
          take: 4, orderBy: { createdAt: 'desc' }, where: { createdAt: { gte: since } },
          select: {
            id: true, invoiceNumber: true, totalAmount: true, taxAmount: true,
            status: true, date: true, createdAt: true,
            vendor: { select: { name: true } }, vendorName: true,
          },
        }),
        db.stockMovement.findMany({
          take: 6, orderBy: { createdAt: 'desc' },
          where: {
            createdAt: { gte: since },
            type: { in: ['PURCHASE', 'SALE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN', 'DAMAGE'] },
          },
          select: {
            id: true, type: true, quantity: true, notes: true, createdAt: true, createdBy: true,
            item: { select: { name: true, itemCode: true, unit: true } },
          },
        }),
        db.salesOrder.findMany({
          take: 4, orderBy: { createdAt: 'desc' }, where: { createdAt: { gte: since } },
          select: {
            id: true, orderNumber: true, totalAmount: true, status: true, createdAt: true,
            customer: { select: { name: true } },
            user: { select: { name: true } },
          },
        }),
        db.appSetting.findUnique({ where: { key: 'stock_scan_time' }, select: { value: true } }),
      ]);

    // Resolve stock movement creator names
    const createdByIds = [...new Set(stockMovements.map((s) => s.createdBy).filter(Boolean))] as string[];
    const users = createdByIds.length > 0
      ? await db.user.findMany({ where: { id: { in: createdByIds } }, select: { id: true, name: true } })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    // Calculate next stock scan time
    const scanTime = (scanSetting?.value && scanSetting.value !== 'false') ? scanSetting.value : '21:00';
    const [scanHour, scanMin] = scanTime.split(':').map(Number);
    const nextScan = new Date();
    nextScan.setHours(scanHour, scanMin, 0, 0);
    if (nextScan <= new Date()) nextScan.setDate(nextScan.getDate() + 1);

    type Detail = Record<string, string | number | null | undefined>;

    const activities = [
      ...invoices.map((inv) => ({
        id: `inv-${inv.id}`,
        type: 'SALE',
        title: `Invoice ${inv.invoiceNumber}`,
        subtitle: inv.customer?.name || inv.customerName || 'Walk-in customer',
        amount: Number(inv.totalAmount),
        timestamp: inv.createdAt,
        user: null as string | null,
        href: `/sales/invoices/${inv.id}`,
        details: {
          'Invoice No': inv.invoiceNumber,
          'Customer': inv.customer?.name || inv.customerName || 'Walk-in',
          'Invoice Date': new Date(inv.invoiceDate).toLocaleDateString('en-IN'),
          'Taxable Amount': `₹${(Number(inv.totalAmount) - Number(inv.taxAmount)).toFixed(2)}`,
          'Tax (GST)': `₹${Number(inv.taxAmount).toFixed(2)}`,
          'Total Amount': `₹${Number(inv.totalAmount).toFixed(2)}`,
          'Status': inv.paymentStatus,
        } as Detail,
      })),
      ...salesOrders.map((so) => ({
        id: `so-${so.id}`,
        type: 'SALES_ORDER',
        title: `Sales Order ${so.orderNumber}`,
        subtitle: so.customer?.name || 'Customer',
        amount: Number(so.totalAmount),
        timestamp: so.createdAt,
        user: so.user?.name || null,
        href: `/sales/orders/${so.id}`,
        details: {
          'Order No': so.orderNumber,
          'Customer': so.customer?.name || '—',
          'Order Date': new Date(so.createdAt).toLocaleDateString('en-IN'),
          'Total Amount': `₹${Number(so.totalAmount).toFixed(2)}`,
          'Status': so.status,
          'Created By': so.user?.name || '—',
        } as Detail,
      })),
      ...payments.map((p) => ({
        id: `pay-${p.id}`,
        type: 'PAYMENT',
        title: `Receipt ${p.paymentNumber}`,
        subtitle: p.customer?.name || 'Customer',
        amount: Number(p.amount),
        timestamp: p.createdAt,
        user: null as string | null,
        href: `/sales/receipts/${p.id}`,
        details: {
          'Receipt No': p.paymentNumber,
          'Customer': p.customer?.name || '—',
          'Payment Date': new Date(p.paymentDate).toLocaleDateString('en-IN'),
          'Amount': `₹${Number(p.amount).toFixed(2)}`,
          'Mode': p.mode,
        } as Detail,
      })),
      ...purchaseInvoices.map((pi) => ({
        id: `pi-${pi.id}`,
        type: 'PURCHASE',
        title: `Purchase ${pi.invoiceNumber}`,
        subtitle: pi.vendor?.name || pi.vendorName || 'Vendor',
        amount: Number(pi.totalAmount),
        timestamp: pi.createdAt,
        user: null as string | null,
        href: `/purchases/invoices/${pi.id}`,
        details: {
          'Invoice No': pi.invoiceNumber,
          'Vendor': pi.vendor?.name || pi.vendorName || '—',
          'Invoice Date': new Date(pi.date).toLocaleDateString('en-IN'),
          'Taxable Amount': `₹${(Number(pi.totalAmount) - Number(pi.taxAmount)).toFixed(2)}`,
          'Tax (GST)': `₹${Number(pi.taxAmount).toFixed(2)}`,
          'Total Amount': `₹${Number(pi.totalAmount).toFixed(2)}`,
          'Status': pi.status,
        } as Detail,
      })),
      ...stockMovements.map((sm) => ({
        id: `sm-${sm.id}`,
        type: sm.type,
        title: `${sm.type.replace(/_/g, ' ')} — ${sm.item?.name || 'Item'}`,
        subtitle: sm.notes || `Qty: ${Number(sm.quantity)}`,
        amount: null as number | null,
        timestamp: sm.createdAt,
        user: sm.createdBy ? (userMap.get(sm.createdBy) || 'Staff') : null,
        href: `/ledger/items`,
        details: {
          'Item': sm.item?.name || '—',
          'Item Code': sm.item?.itemCode || '—',
          'Unit': sm.item?.unit || '—',
          'Movement Type': sm.type.replace(/_/g, ' '),
          'Quantity': `${Number(sm.quantity)}`,
          'Notes': sm.notes || '—',
          'Recorded By': sm.createdBy ? (userMap.get(sm.createdBy) || 'Staff') : 'System',
          'Date': new Date(sm.createdAt).toLocaleDateString('en-IN'),
        } as Detail,
      })),
    ]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 20);

    return NextResponse.json({ events: activities, nextScanAt: nextScan.toISOString() });
  } catch (error) {
    console.error('Error fetching dashboard activity:', error);
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
