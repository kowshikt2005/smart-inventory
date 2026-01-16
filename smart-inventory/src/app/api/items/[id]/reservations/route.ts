import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/items/[id]/reservations - Get sales orders that are reserving stock for this item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get the item with its inventory
    const item = await db.item.findUnique({
      where: { id },
      include: {
        inventory: true,
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Get all open sales orders that contain this item
    const salesOrders = await db.salesOrder.findMany({
      where: {
        status: 'OPEN',
        items: {
          some: {
            itemId: id,
          },
        },
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
          where: {
            itemId: id,
          },
          select: {
            quantity: true,
          },
        },
      },
      orderBy: {
        orderDate: 'desc',
      },
    });

    // Calculate total reserved quantity from these orders
    const totalReserved = salesOrders.reduce((sum, order) => {
      const orderQuantity = order.items.reduce((orderSum, item) => {
        return orderSum + Number(item.quantity);
      }, 0);
      return sum + orderQuantity;
    }, 0);

    return NextResponse.json({
      item: {
        id: item.id,
        itemCode: item.itemCode,
        name: item.name,
        physicalStock: Number(item.inventory?.physicalStock || 0),
        reservedQuantity: Number(item.inventory?.reservedQuantity || 0),
        availableStock: Number(item.inventory?.physicalStock || 0) - Number(item.inventory?.reservedQuantity || 0),
      },
      reservingOrders: salesOrders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
        customer: order.customer,
        reservedQuantity: order.items.reduce((sum, item) => sum + Number(item.quantity), 0),
      })),
      totalReserved,
    });
  } catch (error) {
    console.error('Error fetching item reservations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch item reservations' },
      { status: 500 }
    );
  }
}