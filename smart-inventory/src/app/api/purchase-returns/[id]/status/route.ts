import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isValidPRStatusTransition } from '@/lib/purchase-utils';

// PATCH /api/purchase-returns/[id]/status - Update purchase return status
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

    // Find existing return
    const existingReturn = await db.purchaseReturn.findUnique({
      where: { id },
    });

    if (!existingReturn) {
      return NextResponse.json(
        { error: 'Purchase return not found' },
        { status: 404 }
      );
    }

    // Validate status transition
    if (!isValidPRStatusTransition(existingReturn.status, newStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status transition from ${existingReturn.status} to ${newStatus}`,
          currentStatus: existingReturn.status,
          allowedTransitions: ['OPEN', 'COMPLETED', 'CANCELLED'].filter(s =>
            isValidPRStatusTransition(existingReturn.status, s)
          ),
        },
        { status: 400 }
      );
    }

    // Additional validation for specific transitions
    if (newStatus === 'COMPLETED' && existingReturn.status !== 'OPEN') {
      return NextResponse.json(
        { 
          error: 'Only OPEN returns can be marked as completed' 
        },
        { status: 400 }
      );
    }

    if (newStatus === 'CANCELLED' && existingReturn.status === 'COMPLETED') {
      return NextResponse.json(
        { 
          error: 'Cannot cancel a completed return' 
        },
        { status: 400 }
      );
    }

    // Update the return status
    const updatedReturn = await db.purchaseReturn.update({
      where: { id },
      data: {
        status: newStatus,
        notes: reason
          ? `${existingReturn.notes ? existingReturn.notes + '\n' : ''}[Status: ${newStatus}] ${reason}`
          : existingReturn.notes,
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

    return NextResponse.json(updatedReturn);
  } catch (error: unknown) {
    console.error('Error updating purchase return status:', error);

    const prismaError = error as { code?: string };

    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        { error: 'Purchase return not found' },
        { status: 404 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to update purchase return status';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}