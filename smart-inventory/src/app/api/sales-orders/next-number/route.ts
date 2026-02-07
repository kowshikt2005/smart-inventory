import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateOrderNumber } from '@/lib/order-utils';

export async function GET() {
  try {
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
