import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET /api/reorders/[id] - Get reorder detail
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await auth();
    const { id } = await params;

    const reorder = await db.stockReorder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            item: {
              select: {
                id: true,
                itemCode: true,
                name: true,
                unit: true,
                purchasePrice: true,
                brand: {
                  select: {
                    id: true,
                    name: true,
                    preferredVendorId: true,
                    preferredVendor: {
                      select: { id: true, name: true },
                    },
                  },
                },
              },
            },
            salesOrders: {
              include: {
                salesOrder: {
                  select: {
                    id: true,
                    orderNumber: true,
                    customer: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!reorder) {
      return NextResponse.json({ error: 'Reorder not found' }, { status: 404 });
    }

    return NextResponse.json(reorder);
  } catch (error) {
    console.error('Error fetching reorder:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reorder' },
      { status: 500 }
    );
  }
}

// PATCH /api/reorders/[id] - Cancel a reorder
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await auth();
    const { id } = await params;
    const body = await request.json();

    if (body.status !== 'CANCELLED') {
      return NextResponse.json(
        { error: 'Only CANCELLED status is allowed via this endpoint' },
        { status: 400 }
      );
    }

    const reorder = await db.stockReorder.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!reorder) {
      return NextResponse.json({ error: 'Reorder not found' }, { status: 404 });
    }

    if (reorder.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only PENDING reorders can be cancelled' },
        { status: 400 }
      );
    }

    const updated = await db.stockReorder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating reorder:', error);
    return NextResponse.json(
      { error: 'Failed to update reorder' },
      { status: 500 }
    );
  }
}
