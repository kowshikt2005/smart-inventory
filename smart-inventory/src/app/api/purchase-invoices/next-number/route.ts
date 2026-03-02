import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generatePurchaseInvoiceNumber } from '@/lib/purchase-utils';
import { checkPermission } from '@/lib/api-auth';

export async function GET() {
  try {
    const { error } = await checkPermission('purchases_invoices', 'view');
    if (error) return error;
    const nextInvoiceNumber = await generatePurchaseInvoiceNumber(db);
    return NextResponse.json({ invoiceNumber: nextInvoiceNumber });
  } catch (error) {
    console.error('Error generating next purchase invoice number:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoice number' },
      { status: 500 }
    );
  }
}
