import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SalesOrderStatus } from '@/generated/prisma';
import { checkPermission } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    const { error } = await checkPermission('reports', 'view');
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const brandId = searchParams.get('brandId');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const type = searchParams.get('type') || 'unbilled'; // 'billed' or 'unbilled'

    // Build filters
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (fromDate) {
      dateFilter.gte = new Date(fromDate);
    }
    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.lte = endDate;
    }

    // Billed = has invoices (PARTIALLY_INVOICED or FULLY_INVOICED)
    // Unbilled = no invoices yet (OPEN or HOLD)
    const statusFilter = type === 'billed'
      ? { in: [SalesOrderStatus.PARTIALLY_INVOICED, SalesOrderStatus.FULLY_INVOICED] }
      : { in: [SalesOrderStatus.OPEN, SalesOrderStatus.HOLD] };

    const orders = await db.salesOrder.findMany({
      where: {
        status: statusFilter,
        ...(customerId ? { customerId } : {}),
        ...(brandId ? { items: { some: { item: { brandId } } } } : {}),
        ...(Object.keys(dateFilter).length > 0 ? { orderDate: dateFilter } : {}),
      },
      include: {
        customer: {
          select: {
            id: true,
            customerNumber: true,
            name: true,
            phone: true,
            email: true,
            city: true,
            state: true,
            gstin: true,
          },
        },
        items: {
          include: {
            item: {
              select: {
                id: true,
                itemCode: true,
                name: true,
                unit: true,
              },
            },
          },
        },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            paymentStatus: true,
          },
        },
      },
      orderBy: { orderDate: 'desc' },
    });

    const result = orders.map((order) => {
      const invoicedAmount = order.invoices.reduce(
        (sum, inv) => sum + Number(inv.totalAmount),
        0
      );

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        orderDate: order.orderDate.toISOString().split('T')[0],
        expectedDelivery: order.expectedDelivery
          ? order.expectedDelivery.toISOString().split('T')[0]
          : null,
        status: order.status,
        subtotal: Number(order.subtotal),
        taxAmount: Number(order.taxAmount),
        totalAmount: Number(order.totalAmount),
        invoicedAmount,
        pendingAmount: Number(order.totalAmount) - invoicedAmount,
        notes: order.notes,
        referenceNumber: order.referenceNumber,
        customer: order.customer,
        itemCount: order.items.length,
        invoiceCount: order.invoices.length,
        items: order.items.map((oi) => ({
          id: oi.id,
          itemCode: oi.item.itemCode,
          itemName: oi.item.name,
          unit: oi.item.unit,
          quantity: Number(oi.quantity),
          rate: Number(oi.rate),
          amount: Number(oi.amount),
        })),
      };
    });

    // Summary
    const uniqueCustomers = new Set(result.map((o) => o.customer.id));
    const summary = {
      totalOrders: result.length,
      totalCustomers: uniqueCustomers.size,
      totalAmount: result.reduce((sum, o) => sum + o.totalAmount, 0),
      totalInvoiced: result.reduce((sum, o) => sum + o.invoicedAmount, 0),
      totalPending: result.reduce((sum, o) => sum + o.pendingAmount, 0),
    };

    return NextResponse.json({ orders: result, summary });
  } catch (error) {
    console.error('Error fetching billed/unbilled report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billed/unbilled report' },
      { status: 500 }
    );
  }
}
