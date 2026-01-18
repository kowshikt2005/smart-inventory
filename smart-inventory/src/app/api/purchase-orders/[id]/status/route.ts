import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isValidPOStatusTransition } from '@/lib/purchase-utils';

// PATCH /api/purchase-orders/[id]/status - Update purchase order status
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { status: newStatus, reason } = body;

    if (!newStatus) {
      return NextResponse.json(
        { error: 'New status is required' },
        { status: 400 }
      );
    }

    // Find existing order
    const existingOrder = await db.purchaseOrder.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Validate status transition
    if (!isValidPOStatusTransition(existingOrder.status, newStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status transition from ${existingOrder.status} to ${newStatus}`,
          currentStatus: existingOrder.status,
          allowedTransitions: ['OPEN', 'PARTIAL', 'RECEIVED', 'CANCELLED'].filter(s =>
            isValidPOStatusTransition(existingOrder.status, s)
          ),
        },
        { status: 400 }
      );
    }

    // Update the order status
    const updatedOrder = await db.purchaseOrder.update({
      where: { id },
      data: {
        status: newStatus,
        notes: reason
          ? `${existingOrder.notes ? existingOrder.notes + '\n' : ''}[Status: ${newStatus}] ${reason}`
          : existingOrder.notes,
      },
      include: {
        vendor: {
          select: {
            id: true,
            vendorNumber: true,
            name: true,
          },
        },
        items: {
          include: {
            item: {
              select: {
                id: true,
                itemCode: true,
                name: true,
                unit: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(updatedOrder);
  } catch (error: unknown) {
    console.error('Error updating purchase order status:', error);

    const prismaError = error as { code?: string };

    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to update purchase order status';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
