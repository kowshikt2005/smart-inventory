import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';

// POST /api/sales-returns/[id]/cancel - Cancel an OPEN sales return
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('sales_returns', 'edit');
    if (error) return error;
    const { id } = await params;

    const salesReturn = await db.salesReturn.findUnique({ where: { id } });

    if (!salesReturn) {
      return NextResponse.json({ error: 'Sales return not found' }, { status: 404 });
    }

    if (salesReturn.status !== 'OPEN') {
      return NextResponse.json({ error: 'Can only cancel OPEN sales returns' }, { status: 400 });
    }

    await db.salesReturn.update({ where: { id }, data: { status: 'CANCELLED' } });

    return NextResponse.json({ message: 'Sales return cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling sales return:', error);
    return NextResponse.json({ error: 'Failed to cancel sales return' }, { status: 500 });
  }
}
