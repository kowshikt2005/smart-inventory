import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuth } from '@/lib/api-auth';

// POST /api/import/link-invoice-vendor
// Links an existing master vendor to an imported purchase invoice that has no vendorId.
export async function POST(request: Request) {
  try {
    const { error } = await checkAuth();
    if (error) return error;

    const body = await request.json();
    const { vendorId, purchaseInvoiceId } = body;

    if (!vendorId || !purchaseInvoiceId) {
      return NextResponse.json(
        { error: 'vendorId and purchaseInvoiceId are required' },
        { status: 400 }
      );
    }

    const invoice = await (db.purchaseInvoice.findUnique as any)({
      where: { id: purchaseInvoiceId },
      select: { id: true, vendorId: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Purchase invoice not found' }, { status: 404 });
    }

    if (invoice.vendorId) {
      return NextResponse.json({ error: 'Invoice is already linked to a vendor' }, { status: 409 });
    }

    await (db.purchaseInvoice.update as any)({
      where: { id: purchaseInvoiceId },
      data: { vendorId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Link invoice vendor error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to link vendor to invoice' },
      { status: 500 }
    );
  }
}
