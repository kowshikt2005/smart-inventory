import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateReturnNumber } from '@/lib/invoice-utils';
import { checkPermission } from '@/lib/api-auth';

export async function GET() {
  try {
    const { error } = await checkPermission('sales_returns', 'view');
    if (error) return error;
    const nextReturnNumber = await generateReturnNumber(db);
    return NextResponse.json({ returnNumber: nextReturnNumber });
  } catch (error) {
    console.error('Error generating next return number:', error);
    return NextResponse.json(
      { error: 'Failed to generate return number' },
      { status: 500 }
    );
  }
}
