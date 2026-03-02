import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    const { error } = await checkPermission('reports', 'view');
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'customer'; // 'customer' or 'vendor'
    const customerId = searchParams.get('customerId');
    const vendorId = searchParams.get('vendorId');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (fromDate) {
      dateFilter.gte = new Date(fromDate);
    }
    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.lte = endDate;
    }

    if (type === 'vendor') {
      // Vendor outstanding from PurchaseInvoice
      const purchaseInvoices = await db.purchaseInvoice.findMany({
        where: {
          balanceAmount: { gt: 0 },
          status: { not: 'PAID' },
          ...(vendorId ? { vendorId } : {}),
          ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
        },
        include: {
          vendor: {
            select: { id: true, name: true, creditDays: true },
          },
        },
        orderBy: { date: 'desc' },
      });

      const outstanding = purchaseInvoices
        .map((inv) => {
          const invoiceDate = new Date(inv.date);
          invoiceDate.setHours(0, 0, 0, 0);

          let effectiveDueDate: Date;
          if (inv.dueDate) {
            effectiveDueDate = new Date(inv.dueDate);
            effectiveDueDate.setHours(0, 0, 0, 0);
          } else {
            effectiveDueDate = new Date(
              invoiceDate.getTime() + inv.vendor.creditDays * 24 * 60 * 60 * 1000
            );
          }

          const daysOverdue = Math.round(
            (today.getTime() - effectiveDueDate.getTime()) / (24 * 60 * 60 * 1000)
          );

          return {
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            invoiceDate: invoiceDate.toISOString().split('T')[0],
            dueDate: effectiveDueDate.toISOString().split('T')[0],
            totalAmount: Number(inv.totalAmount),
            balanceAmount: Number(inv.balanceAmount),
            paidAmount: Number(inv.paidAmount),
            daysOverdue,
            status: inv.status,
            vendorId: inv.vendor.id,
            vendorName: inv.vendor.name,
            creditDays: inv.vendor.creditDays,
            // Use common field names for UI
            partyId: inv.vendor.id,
            partyName: inv.vendor.name,
          };
        })
        .sort((a, b) => b.daysOverdue - a.daysOverdue);

      const uniqueVendors = new Set(outstanding.map((inv) => inv.vendorId));
      const summary = {
        totalParties: uniqueVendors.size,
        totalInvoices: outstanding.length,
        totalOutstanding: outstanding.reduce((sum, inv) => sum + inv.balanceAmount, 0),
      };

      return NextResponse.json({ invoices: outstanding, summary });
    }

    // Customer outstanding (default) from Invoice
    const invoices = await db.invoice.findMany({
      where: {
        balanceAmount: { gt: 0 },
        paymentStatus: { not: 'PAID' },
        ...(customerId ? { customerId } : {}),
        ...(Object.keys(dateFilter).length > 0 ? { invoiceDate: dateFilter } : {}),
      },
      include: {
        customer: {
          select: { id: true, name: true, creditDays: true },
        },
      },
      orderBy: { invoiceDate: 'desc' },
    });

    const outstanding = invoices
      .map((inv) => {
        const invoiceDate = new Date(inv.invoiceDate);
        invoiceDate.setHours(0, 0, 0, 0);

        let effectiveDueDate: Date;
        if (inv.dueDate) {
          effectiveDueDate = new Date(inv.dueDate);
          effectiveDueDate.setHours(0, 0, 0, 0);
        } else {
          effectiveDueDate = new Date(
            invoiceDate.getTime() + inv.customer.creditDays * 24 * 60 * 60 * 1000
          );
        }

        const daysOverdue = Math.round(
          (today.getTime() - effectiveDueDate.getTime()) / (24 * 60 * 60 * 1000)
        );

        return {
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: invoiceDate.toISOString().split('T')[0],
          dueDate: effectiveDueDate.toISOString().split('T')[0],
          totalAmount: Number(inv.totalAmount),
          balanceAmount: Number(inv.balanceAmount),
          paidAmount: Number(inv.paidAmount),
          daysOverdue,
          status: inv.paymentStatus,
          customerId: inv.customer.id,
          customerName: inv.customer.name,
          creditDays: inv.customer.creditDays,
          // Use common field names for UI
          partyId: inv.customer.id,
          partyName: inv.customer.name,
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    const uniqueCustomers = new Set(outstanding.map((inv) => inv.customerId));
    const summary = {
      totalParties: uniqueCustomers.size,
      totalInvoices: outstanding.length,
      totalOutstanding: outstanding.reduce((sum, inv) => sum + inv.balanceAmount, 0),
    };

    return NextResponse.json({ invoices: outstanding, summary });
  } catch (error) {
    console.error('Error fetching outstanding report:', error);
    return NextResponse.json({ error: 'Failed to fetch outstanding report' }, { status: 500 });
  }
}
