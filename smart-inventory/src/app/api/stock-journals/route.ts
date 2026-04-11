import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { generateJournalNumber } from '@/lib/invoice-utils';
import { SYSTEM_USER_ID } from '@/lib/order-utils';
import { checkPermission } from '@/lib/api-auth';

// GET /api/stock-journals - List all stock journals
export async function GET(request: Request) {
  try {
    const { error } = await checkPermission('ledger_stock_journal', 'view');
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { journalNumber: { contains: search } },
        { reason: { contains: search } },
      ];
    }

    const [journals, total] = await Promise.all([
      db.stockJournal.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      db.stockJournal.count({ where }),
    ]);

    // Fetch item details for each journal
    const itemIds = [...new Set(journals.map(j => j.itemId))];
    const items = await db.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, itemCode: true, name: true, unit: true },
    });
    const itemMap = new Map(items.map(i => [i.id, i]));

    const journalsWithItems = journals.map(j => ({
      ...j,
      item: itemMap.get(j.itemId) || null,
    }));

    return NextResponse.json({
      journals: journalsWithItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching stock journals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock journals' },
      { status: 500 }
    );
  }
}

// POST /api/stock-journals - Create a new stock journal entry
export async function POST(request: Request) {
  let requestedQty = 0;
  try {
    const { error } = await checkPermission('ledger_stock_journal', 'edit');
    if (error) return error;

    const body = await request.json();
    const { itemId, date, adjustmentType, quantity, reason } = body;

    // Validate required fields
    if (!itemId || !date || !adjustmentType || !quantity) {
      return NextResponse.json(
        { error: 'Missing required fields: itemId, date, adjustmentType, quantity' },
        { status: 400 }
      );
    }

    // Validate adjustment type
    const validTypes = ['INCREASE', 'DECREASE', 'RESERVED', 'UNRESERVED'];
    if (!validTypes.includes(adjustmentType)) {
      return NextResponse.json(
        { error: `Invalid adjustmentType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate quantity
    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be a positive number' },
        { status: 400 }
      );
    }
    requestedQty = qty;

    // Create journal entry in transaction
    const result = await transaction(async (tx) => {
      const item = await tx.item.findUnique({
        where: { id: itemId },
        include: { inventory: true },
      });

      if (!item) {
        throw new Error('ITEM_NOT_FOUND');
      }

      // Ensure inventory record exists inside the same transaction.
      const inventory = item.inventory || await tx.inventory.create({
        data: {
          itemId: item.id,
          physicalStock: 0,
          reservedQuantity: 0,
          minStockLevel: Number(item.minStock) || 0,
        },
      });

      const physicalStock = Number(inventory.physicalStock);
      const reservedQuantity = Number(inventory.reservedQuantity);
      const availableStock = physicalStock - reservedQuantity;

      // Generate journal number
      const journalNumber = await generateJournalNumber(tx as any);

      // Map adjustment type to stock movement type
      let journalType: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'TRANSFER' | 'RETURN';
      let stockMovementType: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'TRANSFER' | 'RETURN';

      switch (adjustmentType) {
        case 'INCREASE':
          journalType = 'ADJUSTMENT_IN';
          stockMovementType = 'ADJUSTMENT_IN';
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { physicalStock: { increment: qty } },
          });
          break;
        case 'DECREASE':
          if (availableStock < qty) {
            throw new Error(`INSUFFICIENT_PHYSICAL:${availableStock}`);
          }

          journalType = 'ADJUSTMENT_OUT';
          stockMovementType = 'ADJUSTMENT_OUT';
          // Optimistic guard prevents lost updates between read and write.
          {
            const updated = await tx.inventory.updateMany({
              where: {
                id: inventory.id,
                physicalStock,
                reservedQuantity,
              },
              data: { physicalStock: { decrement: qty } },
            });
            if (updated.count !== 1) throw new Error('INVENTORY_CONFLICT');
          }
          break;
        case 'RESERVED':
          if (availableStock < qty) {
            throw new Error(`INSUFFICIENT_AVAILABLE:${availableStock}`);
          }

          // Dedicated type allows deterministic reversal on delete.
          journalType = 'TRANSFER';
          stockMovementType = 'TRANSFER';
          {
            const updated = await tx.inventory.updateMany({
              where: {
                id: inventory.id,
                physicalStock,
                reservedQuantity,
              },
              data: { reservedQuantity: { increment: qty } },
            });
            if (updated.count !== 1) throw new Error('INVENTORY_CONFLICT');
          }
          break;
        case 'UNRESERVED':
          if (reservedQuantity < qty) {
            throw new Error(`INSUFFICIENT_RESERVED:${reservedQuantity}`);
          }

          // Dedicated type allows deterministic reversal on delete.
          journalType = 'RETURN';
          stockMovementType = 'RETURN';
          {
            const updated = await tx.inventory.updateMany({
              where: {
                id: inventory.id,
                physicalStock,
                reservedQuantity,
              },
              data: { reservedQuantity: { decrement: qty } },
            });
            if (updated.count !== 1) throw new Error('INVENTORY_CONFLICT');
          }
          break;
        default:
          throw new Error('Invalid adjustment type');
      }

      // Create stock journal
      const journal = await tx.stockJournal.create({
        data: {
          journalNumber,
          date: new Date(date),
          itemId,
          quantity: qty,
          type: journalType,
          reason: reason || null,
          createdBy: SYSTEM_USER_ID,
        },
      });

      // Create stock movement record for audit trail
      await tx.stockMovement.create({
        data: {
          inventoryId: inventory.id,
          itemId,
          quantity: qty,
          type: stockMovementType,
          referenceType: 'STOCK_JOURNAL',
          referenceId: journal.id,
          notes: `Stock Journal ${journalNumber} - ${adjustmentType}: ${reason || 'No reason provided'}`,
        },
      });

      return journal;
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    // Fetch complete journal with relations
    const completeJournal = await db.stockJournal.findUnique({
      where: { id: result.id },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    const item = await db.item.findUnique({
      where: { id: itemId },
      select: { id: true, itemCode: true, name: true, unit: true },
    });

    const journalWithItem = {
      ...completeJournal,
      item,
    };

    return NextResponse.json(journalWithItem, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'ITEM_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message === 'INVENTORY_CONFLICT') {
      return NextResponse.json(
        { error: 'Inventory changed concurrently. Please retry.' },
        { status: 409 }
      );
    }

    if (error instanceof Error && error.message.startsWith('INSUFFICIENT_PHYSICAL:')) {
      const available = error.message.split(':')[1] || '0';
      return NextResponse.json(
        { error: `Insufficient physical stock. Available: ${available}, Requested: ${requestedQty}` },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.startsWith('INSUFFICIENT_AVAILABLE:')) {
      const available = error.message.split(':')[1] || '0';
      return NextResponse.json(
        { error: `Insufficient available stock. Available: ${available}, Requested: ${requestedQty}` },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.startsWith('INSUFFICIENT_RESERVED:')) {
      const reserved = error.message.split(':')[1] || '0';
      return NextResponse.json(
        { error: `Insufficient reserved quantity. Reserved: ${reserved}, Requested: ${requestedQty}` },
        { status: 400 }
      );
    }

    console.error('Error creating stock journal:', error);
    return NextResponse.json(
      { error: 'Failed to create stock journal' },
      { status: 500 }
    );
  }
}
