import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';

// GET /api/stock-journals/[id] - Get a single stock journal
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const journal = await db.stockJournal.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    if (!journal) {
      return NextResponse.json(
        { error: 'Stock journal not found' },
        { status: 404 }
      );
    }

    // Fetch item details
    const item = await db.item.findUnique({
      where: { id: journal.itemId },
      select: { id: true, itemCode: true, name: true, unit: true },
    });

    return NextResponse.json({
      ...journal,
      item,
    });
  } catch (error) {
    console.error('Error fetching stock journal:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock journal' },
      { status: 500 }
    );
  }
}

// DELETE /api/stock-journals/[id] - Delete a stock journal (reverse the transaction)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const journal = await db.stockJournal.findUnique({
      where: { id },
    });

    if (!journal) {
      return NextResponse.json(
        { error: 'Stock journal not found' },
        { status: 404 }
      );
    }

    // Get inventory
    const inventory = await db.inventory.findUnique({
      where: { itemId: journal.itemId },
    });

    if (!inventory) {
      return NextResponse.json(
        { error: 'Inventory record not found' },
        { status: 404 }
      );
    }

    const qty = Number(journal.quantity);

    // Reverse the transaction
    await transaction(async (tx) => {
      // Determine what to reverse based on the original type
      // ADJUSTMENT_IN was either INCREASE or UNRESERVED
      // ADJUSTMENT_OUT was either DECREASE or RESERVED
      
      // Check stock movement to determine original action
      const stockMovement = await tx.stockMovement.findFirst({
        where: {
          referenceType: 'STOCK_JOURNAL',
          referenceId: id,
        },
      });

      if (stockMovement) {
        const notes = stockMovement.notes || '';
        
        if (notes.includes('INCREASE')) {
          // Reverse INCREASE: decrement physical stock
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { physicalStock: { decrement: qty } },
          });
        } else if (notes.includes('DECREASE')) {
          // Reverse DECREASE: increment physical stock
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { physicalStock: { increment: qty } },
          });
        } else if (notes.includes('RESERVED')) {
          // Reverse RESERVED: decrement reserved quantity
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { reservedQuantity: { decrement: qty } },
          });
        } else if (notes.includes('UNRESERVED')) {
          // Reverse UNRESERVED: increment reserved quantity
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { reservedQuantity: { increment: qty } },
          });
        }

        // Delete the stock movement
        await tx.stockMovement.delete({
          where: { id: stockMovement.id },
        });
      }

      // Delete the journal
      await tx.stockJournal.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true, message: 'Stock journal deleted and reversed' });
  } catch (error) {
    console.error('Error deleting stock journal:', error);
    return NextResponse.json(
      { error: 'Failed to delete stock journal' },
      { status: 500 }
    );
  }
}
