import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';

// GET /api/stock-journals/[id] - Get a single stock journal
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('ledger_stock_journal', 'view');
    if (error) return error;

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
    const { error } = await checkPermission('ledger_stock_journal', 'edit');
    if (error) return error;

    const { id } = await params;

    // Reverse the transaction
    await transaction(async (tx) => {
      const journal = await tx.stockJournal.findUnique({
        where: { id },
      });

      if (!journal) {
        throw new Error('JOURNAL_NOT_FOUND');
      }

      const inventory = await tx.inventory.findUnique({
        where: { itemId: journal.itemId },
      });

      if (!inventory) {
        throw new Error('INVENTORY_NOT_FOUND');
      }

      const qty = Number(journal.quantity);

      const linkedMovement = await tx.stockMovement.findFirst({
        where: {
          referenceType: 'STOCK_JOURNAL',
          referenceId: id,
        },
        select: { notes: true },
        orderBy: { createdAt: 'desc' },
      });

      const notesText = (linkedMovement?.notes || '').toUpperCase();
      const reasonText = (journal.reason || '').toUpperCase();
      const hasLegacyReservedMarker = /\bRESERVED\b/.test(notesText) ||
        (!linkedMovement && /\bRESERVED\b/.test(reasonText));
      const hasLegacyUnreservedMarker = /\bUNRESERVED\b/.test(notesText) ||
        (!linkedMovement && /\bUNRESERVED\b/.test(reasonText));

      switch (journal.type) {
        case 'ADJUSTMENT_IN': {
          if (hasLegacyUnreservedMarker) {
            await tx.inventory.update({
              where: { id: inventory.id },
              data: { reservedQuantity: { increment: qty } },
            });
          } else {
            const updated = await tx.inventory.updateMany({
              where: { id: inventory.id, physicalStock: { gte: qty } },
              data: { physicalStock: { decrement: qty } },
            });
            if (updated.count !== 1) throw new Error('INSUFFICIENT_PHYSICAL_FOR_REVERSE');
          }
          break;
        }
        case 'ADJUSTMENT_OUT': {
          if (hasLegacyReservedMarker) {
            const updated = await tx.inventory.updateMany({
              where: { id: inventory.id, reservedQuantity: { gte: qty } },
              data: { reservedQuantity: { decrement: qty } },
            });
            if (updated.count !== 1) throw new Error('INSUFFICIENT_RESERVED_FOR_REVERSE');
          } else {
            await tx.inventory.update({
              where: { id: inventory.id },
              data: { physicalStock: { increment: qty } },
            });
          }
          break;
        }
        case 'TRANSFER': {
          const updated = await tx.inventory.updateMany({
            where: { id: inventory.id, reservedQuantity: { gte: qty } },
            data: { reservedQuantity: { decrement: qty } },
          });
          if (updated.count !== 1) throw new Error('INSUFFICIENT_RESERVED_FOR_REVERSE');
          break;
        }
        case 'RETURN':
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { reservedQuantity: { increment: qty } },
          });
          break;
        default:
          throw new Error(`Unsupported journal type: ${journal.type}`);
      }

      await tx.stockMovement.deleteMany({
        where: {
          referenceType: 'STOCK_JOURNAL',
          referenceId: id,
        },
      });

      // Delete the journal
      await tx.stockJournal.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true, message: 'Stock journal deleted and reversed' });
  } catch (error) {
    if (error instanceof Error && error.message === 'JOURNAL_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Stock journal not found' },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message === 'INVENTORY_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Inventory record not found' },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message === 'INSUFFICIENT_PHYSICAL_FOR_REVERSE') {
      return NextResponse.json(
        { error: 'Cannot reverse journal: physical stock is lower than journal quantity.' },
        { status: 409 }
      );
    }

    if (error instanceof Error && error.message === 'INSUFFICIENT_RESERVED_FOR_REVERSE') {
      return NextResponse.json(
        { error: 'Cannot reverse journal: reserved stock is lower than journal quantity.' },
        { status: 409 }
      );
    }

    console.error('Error deleting stock journal:', error);
    return NextResponse.json(
      { error: 'Failed to delete stock journal' },
      { status: 500 }
    );
  }
}
