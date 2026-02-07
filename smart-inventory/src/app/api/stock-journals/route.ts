import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { generateJournalNumber } from '@/lib/invoice-utils';
import { SYSTEM_USER_ID } from '@/lib/order-utils';

// GET /api/stock-journals - List all stock journals
export async function GET(request: Request) {
  try {
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
  try {
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

    // Check item exists and get inventory
    const item = await db.item.findUnique({
      where: { id: itemId },
      include: { inventory: true },
    });

    if (!item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Ensure inventory record exists
    let inventory = item.inventory;
    if (!inventory) {
      inventory = await db.inventory.create({
        data: {
          itemId: item.id,
          physicalStock: 0,
          reservedQuantity: 0,
          minStockLevel: Number(item.minStock) || 0,
        },
      });
    }

    const physicalStock = Number(inventory.physicalStock);
    const reservedQuantity = Number(inventory.reservedQuantity);

    // Validate stock levels for DECREASE and UNRESERVED
    if (adjustmentType === 'DECREASE' && physicalStock < qty) {
      return NextResponse.json(
        { error: `Insufficient physical stock. Available: ${physicalStock}, Requested: ${qty}` },
        { status: 400 }
      );
    }

    if (adjustmentType === 'UNRESERVED' && reservedQuantity < qty) {
      return NextResponse.json(
        { error: `Insufficient reserved quantity. Reserved: ${reservedQuantity}, Requested: ${qty}` },
        { status: 400 }
      );
    }

    // Create journal entry in transaction
    const result = await transaction(async (tx) => {
      // Generate journal number
      const journalNumber = await generateJournalNumber(tx as any);

      // Map adjustment type to stock movement type
      let stockMovementType: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
      let inventoryUpdate: any = {};

      switch (adjustmentType) {
        case 'INCREASE':
          stockMovementType = 'ADJUSTMENT_IN';
          inventoryUpdate = { physicalStock: { increment: qty } };
          break;
        case 'DECREASE':
          stockMovementType = 'ADJUSTMENT_OUT';
          inventoryUpdate = { physicalStock: { decrement: qty } };
          break;
        case 'RESERVED':
          stockMovementType = 'ADJUSTMENT_OUT'; // Reserved reduces available
          inventoryUpdate = { reservedQuantity: { increment: qty } };
          break;
        case 'UNRESERVED':
          stockMovementType = 'ADJUSTMENT_IN'; // Unreserved increases available
          inventoryUpdate = { reservedQuantity: { decrement: qty } };
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
          type: stockMovementType,
          reason: reason || null,
          createdBy: SYSTEM_USER_ID,
        },
      });

      // Update inventory
      await tx.inventory.update({
        where: { id: inventory!.id },
        data: inventoryUpdate,
      });

      // Create stock movement record for audit trail
      await tx.stockMovement.create({
        data: {
          inventoryId: inventory!.id,
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

    // Add item info
    const journalWithItem = {
      ...completeJournal,
      item: { id: item.id, itemCode: item.itemCode, name: item.name, unit: item.unit },
    };

    return NextResponse.json(journalWithItem, { status: 201 });
  } catch (error) {
    console.error('Error creating stock journal:', error);
    return NextResponse.json(
      { error: 'Failed to create stock journal' },
      { status: 500 }
    );
  }
}
