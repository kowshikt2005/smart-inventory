import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generatePaymentNumber } from '@/lib/invoice-utils';
import { checkPermission } from '@/lib/api-auth';

export async function GET() {
  try {
    const { error } = await checkPermission('sales_receipts', 'view');
    if (error) return error;
    const nextPaymentNumber = await generatePaymentNumber(db);
    return NextResponse.json({ paymentNumber: nextPaymentNumber });
  } catch (error) {
    console.error('Error generating next payment number:', error);
    return NextResponse.json(
      { error: 'Failed to generate payment number' },
      { status: 500 }
    );
  }
}
