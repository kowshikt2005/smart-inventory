import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isValidPIStatusTransition } from '@/lib/purchase-utils';

// PATCH /api/purchase-invoices/[id]/status - Update purchase invoice status
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

    // Find existing invoice
    const existingInvoice = await db.purchaseInvoice.findUnique({
      where: { id },
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: 'Purchase invoice not found' },
        { status: 404 }
      );
    }

    // Validate status transition
    if (!isValidPIStatusTransition(existingInvoice.status, newStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status transition from ${existingInvoice.status} to ${newStatus}`,
          currentStatus: existingInvoice.status,
          allowedTransitions: ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'].filter(s =>
            isValidPIStatusTransition(existingInvoice.status, s)
          ),
        },
        { status: 400 }
      );
    }

    // Additional validation for specific transitions
    if ((newStatus === 'PAID' || newStatus === 'CANCELLED') && Number(existingInvoice.balanceAmount) > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot mark as paid/cancelled while there is outstanding balance' 
        },
        { status: 400 }
      );
    }

    // Update the invoice status
    const updatedInvoice = await db.purchaseInvoice.update({
      where: { id },
      data: {
        status: newStatus,
        notes: reason
          ? `${existingInvoice.notes ? existingInvoice.notes + '\n' : ''}[Status: ${newStatus}] ${reason}`
          : existingInvoice.notes,
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

    return NextResponse.json(updatedInvoice);
  } catch (error: unknown) {
    console.error('Error updating purchase invoice status:', error);

    const prismaError = error as { code?: string };

    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        { error: 'Purchase invoice not found' },
        { status: 404 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to update purchase invoice status';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}