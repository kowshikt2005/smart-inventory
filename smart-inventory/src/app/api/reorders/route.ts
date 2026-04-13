import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';

// GET /api/reorders - List all stock reorders with pagination
export async function GET(request: Request) {
  try {
    const { error } = await checkPermission('purchases_reorders', 'view');
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '15');
    const skip = (page - 1) * limit;

    const validStatuses = ['PENDING', 'CONVERTED', 'CANCELLED'];
    if (status && status !== 'ALL' && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')} or ALL` },
        { status: 400 }
      );
    }

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const [reorders, total] = await Promise.all([
      db.stockReorder.findMany({
        where,
        include: {
          _count: {
            select: { items: true, salesOrders: true },
          },
          salesOrders: {
            select: { salesOrderId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.stockReorder.count({ where }),
    ]);

    return NextResponse.json({
      reorders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching reorders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reorders' },
      { status: 500 }
    );
  }
}
