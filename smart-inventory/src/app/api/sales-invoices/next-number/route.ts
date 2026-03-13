import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateInvoiceNumber } from '@/lib/invoice-utils';
import { checkPermission } from '@/lib/api-auth';

export async function GET() {
  try {
    const { error } = await checkPermission('sales_invoices', 'view');
    if (error) return error;
    const invoiceNumber = await generateInvoiceNumber(db);
    return NextResponse.json({ invoiceNumber });
  } catch (error) {
    console.error('Error generating next invoice number:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoice number' },
      { status: 500 }
    );
  }
}
