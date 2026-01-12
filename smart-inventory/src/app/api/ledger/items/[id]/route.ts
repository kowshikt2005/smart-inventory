import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/ledger/items/[id] - Get stock ledger for an item
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    // Check item exists
    const item = await db.item.findUnique({
      where: { id },
      select: {
        id: true,
        itemCode: true,
        name: true,
        unit: true,
        inventory: {
          select: {
            physicalStock: true,
            reservedQuantity: true,
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Build where clause for movements
    const where: any = { itemId: id };

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    // Calculate opening balance (sum of all movements before fromDate)
    let openingBalance = 0;
    if (fromDate) {
      const priorMovements = await db.stockMovement.findMany({
        where: {
          itemId: id,
          createdAt: { lt: new Date(fromDate) },
        },
      });

      for (const movement of priorMovements) {
        const qty = Number(movement.quantity);
        if (['PURCHASE', 'ADJUSTMENT_IN', 'RETURN'].includes(movement.type)) {
          openingBalance += qty;
        } else if (['SALE', 'ADJUSTMENT_OUT', 'DAMAGE', 'TRANSFER'].includes(movement.type)) {
          openingBalance -= qty;
        }
      }
    }

    // Get movements within date range
    const movements = await db.stockMovement.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    // Calculate running balances and format movements
    let runningBalance = openingBalance;
    let totalIn = 0;
    let totalOut = 0;

    const formattedMovements = movements.map((movement) => {
      const qty = Number(movement.quantity);
      let inQty = 0;
      let outQty = 0;
      let particulars = '';

      // Determine in/out based on movement type
      if (['PURCHASE', 'ADJUSTMENT_IN', 'RETURN'].includes(movement.type)) {
        inQty = qty;
        totalIn += qty;
        runningBalance += qty;
      } else if (['SALE', 'ADJUSTMENT_OUT', 'DAMAGE', 'TRANSFER'].includes(movement.type)) {
        outQty = qty;
        totalOut += qty;
        runningBalance -= qty;
      }

      // Generate particulars based on reference type
      switch (movement.referenceType) {
        case 'SALES_ORDER':
          particulars = `Sales Order`;
          break;
        case 'SALES_RETURN':
          particulars = `Sales Return`;
          break;
        case 'PURCHASE_ORDER':
          particulars = `Purchase Order`;
          break;
        case 'STOCK_JOURNAL':
          particulars = movement.notes || 'Stock Journal';
          break;
        default:
          particulars = movement.notes || movement.type.replace(/_/g, ' ');
      }

      return {
        id: movement.id,
        date: movement.createdAt,
        type: movement.type,
        particulars,
        referenceType: movement.referenceType,
        referenceId: movement.referenceId,
        inQty,
        outQty,
        runningBalance,
      };
    });

    const closingBalance = openingBalance + totalIn - totalOut;

    return NextResponse.json({
      item: {
        id: item.id,
        itemCode: item.itemCode,
        name: item.name,
        unit: item.unit,
        currentStock: Number(item.inventory?.physicalStock || 0),
        reservedQuantity: Number(item.inventory?.reservedQuantity || 0),
      },
      movements: formattedMovements,
      summary: {
        openingBalance,
        totalIn,
        totalOut,
        closingBalance,
      },
    });
  } catch (error) {
    console.error('Error fetching stock ledger:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock ledger' },
      { status: 500 }
    );
  }
}
