import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/sales-returns/[id] - Get single sales return
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const salesReturn = await db.salesReturn.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            customerNumber: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            totalAmount: true,
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
                hsnCode: true,
                gstRate: true,
              },
            },
          },
        },
      },
    });

    if (!salesReturn) {
      return NextResponse.json(
        { error: 'Sales return not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(salesReturn);
  } catch (error) {
    console.error('Error fetching sales return:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales return' },
      { status: 500 }
    );
  }
}

// PUT /api/sales-returns/[id] - Update sales return (only if OPEN)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const salesReturn = await db.salesReturn.findUnique({
      where: { id },
    });

    if (!salesReturn) {
      return NextResponse.json(
        { error: 'Sales return not found' },
        { status: 404 }
      );
    }

    if (salesReturn.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'Can only update OPEN sales returns' },
        { status: 400 }
      );
    }

    const updatedReturn = await db.salesReturn.update({
      where: { id },
      data: {
        reason: body.reason !== undefined ? body.reason : salesReturn.reason,
      },
      include: {
        customer: {
          select: {
            id: true,
            customerNumber: true,
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
  } catch (error) {
    console.error('Error updating sales return:', error);
    return NextResponse.json(
      { error: 'Failed to update sales return' },
      { status: 500 }
    );
  }
}

// DELETE /api/sales-returns/[id] - Cancel sales return (only if OPEN)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const salesReturn = await db.salesReturn.findUnique({
      where: { id },
    });

    if (!salesReturn) {
      return NextResponse.json(
        { error: 'Sales return not found' },
        { status: 404 }
      );
    }

    if (salesReturn.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'Can only cancel OPEN sales returns' },
        { status: 400 }
      );
    }

    await db.salesReturn.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
    });

    return NextResponse.json({ message: 'Sales return cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling sales return:', error);
    return NextResponse.json(
      { error: 'Failed to cancel sales return' },
      { status: 500 }
    );
  }
}
