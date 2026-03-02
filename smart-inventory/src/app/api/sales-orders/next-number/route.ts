import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateOrderNumber } from '@/lib/order-utils';
import { checkPermission } from '@/lib/api-auth';

export async function GET() {
  try {
    const { error } = await checkPermission('sales_orders', 'view');
    if (error) return error;
    const nextOrderNumber = await generateOrderNumber(db);
    return NextResponse.json({ orderNumber: nextOrderNumber });
  } catch (error) {
    console.error('Error generating next order number:', error);
    return NextResponse.json(
      { error: 'Failed to generate order number' },
      { status: 500 }
    );
  }
}
