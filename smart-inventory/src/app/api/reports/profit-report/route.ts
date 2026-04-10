import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';

// GET /api/reports/profit-report
export async function GET(request: Request) {
  try {
    const { error } = await checkPermission('reports', 'view');
    if (error) return error;

    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const brandId = searchParams.get('brandId') || '';
    const customerId = searchParams.get('customerId') || '';
    const productId = searchParams.get('productId') || '';

    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const where: any = {
      invoiceDate: {
        gte: startDate ? new Date(startDate) : defaultStart,
        lte: endDate ? new Date(endDate) : defaultEnd,
      },
      status: { not: 'CANCELLED' },
    };

    if (customerId) where.customerId = customerId;

    const invoices = await db.invoice.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, customerNumber: true } },
        items: {
          include: {
            item: {
              include: {
                brand: { select: { id: true, name: true } },
                subBrand: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { invoiceDate: 'desc' },
    });

    const records: any[] = [];

    for (const invoice of invoices) {
      for (const invoiceItem of invoice.items) {
        const item = invoiceItem.item;
        if (!item) continue;

        // Apply filters
        if (brandId && item.brandId !== brandId) continue;
        if (productId && item.id !== productId) continue;

        const qty = Number(invoiceItem.quantity);
        const soldRate = Number(invoiceItem.rate); // before GST
        const taxRate = Number(invoiceItem.taxRate);
        const soldAmountExclGST = Number(invoiceItem.amount); // rate × qty after discount
        const soldTaxAmount = Number(invoiceItem.taxAmount);
        const soldAmountInclGST = soldAmountExclGST + soldTaxAmount;
        const soldRateInclGST = qty > 0 ? soldAmountInclGST / qty : 0;

        const purchasePriceExclGST = Number(item.purchasePrice);
        const itemGstRate = Number(item.gstRate);
        const purchasePriceInclGST = purchasePriceExclGST * (1 + itemGstRate / 100);
        const purchaseAmountInclGST = purchasePriceInclGST * qty;

        const grossMargin = purchaseAmountInclGST - soldAmountInclGST;
        const marginPct = soldAmountInclGST > 0 ? (grossMargin / soldAmountInclGST) * 100 : 0;

        records.push({
          date: invoice.invoiceDate,
          invoiceNumber: invoice.invoiceNumber,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          customer: invoice.customer?.name || invoice.customerName || '-',
          brandId: item.brandId,
          brand: item.brand?.name || 'N/A',
          subBrand: item.subBrand?.name || '',
          productId: item.id,
          productName: item.name,
          itemCode: item.itemCode,
          qty,
          taxRate,
          soldRateExclGST: soldRate,
          soldRateInclGST,
          purchasePriceExclGST,
          purchasePriceInclGST,
          soldAmountInclGST,
          purchaseAmountInclGST,
          grossMargin,
          marginPct,
        });
      }
    }

    const totalSold = records.reduce((s, r) => s + r.soldAmountInclGST, 0);
    const totalPurchase = records.reduce((s, r) => s + r.purchaseAmountInclGST, 0);
    const totalMargin = totalPurchase - totalSold;

    return NextResponse.json({
      records,
      summary: {
        totalRecords: records.length,
        totalSoldAmount: totalSold,
        totalPurchaseAmount: totalPurchase,
        totalGrossMargin: totalMargin,
        overallMarginPct: totalSold > 0 ? (totalMargin / totalSold) * 100 : 0,
      },
    });
  } catch (error) {
    console.error('Error fetching profit report:', error);
    return NextResponse.json({ error: 'Failed to fetch profit report' }, { status: 500 });
  }
}
