import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generatePurchaseInvoiceNumber } from '@/lib/purchase-utils';

export async function GET() {
  try {
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
