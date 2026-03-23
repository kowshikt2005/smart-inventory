import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuth } from '@/lib/api-auth';

// POST /api/import/link-invoice-customer
// Links an existing master customer to an imported sales invoice that has no customerId.
export async function POST(request: Request) {
  try {
    const { error } = await checkAuth();
    if (error) return error;

    const body = await request.json();
    const { customerId, salesInvoiceId } = body;

    if (!customerId || !salesInvoiceId) {
      return NextResponse.json(
        { error: 'customerId and salesInvoiceId are required' },
        { status: 400 }
      );
    }

    const invoice = await db.invoice.findUnique({
      where: { id: salesInvoiceId },
      select: { id: true, customerId: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Sales invoice not found' }, { status: 404 });
    }

    if (invoice.customerId) {
      return NextResponse.json({ error: 'Invoice is already linked to a customer' }, { status: 409 });
    }

    await db.invoice.update({
      where: { id: salesInvoiceId },
      data: { customerId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Link invoice customer error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to link customer to invoice' },
      { status: 500 }
    );
  }
}
