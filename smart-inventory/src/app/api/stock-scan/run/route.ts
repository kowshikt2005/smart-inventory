import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';
import { runStockScan } from '@/lib/reorder-utils';

// POST /api/stock-scan/run - Trigger stock scan manually
export async function POST() {
  try {
    const { error } = await checkPermission('purchases_reorders', 'edit');
    if (error) return error;
    const result = await runStockScan(db);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error running stock scan:', error);
    return NextResponse.json(
      { error: 'Failed to run stock scan' },
      { status: 500 }
    );
  }
}
