import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generatePurchaseOrderNumber } from '@/lib/purchase-utils';

export async function GET() {
  try {
    const nextOrderNumber = await generatePurchaseOrderNumber(db);
    return NextResponse.json({ orderNumber: nextOrderNumber });
  } catch (error) {
    console.error('Error generating next purchase order number:', error);
    return NextResponse.json(
      { error: 'Failed to generate order number' },
      { status: 500 }
    );
  }
}
