import { PrismaClient } from '@/generated/prisma';

/**
 * Priority-based stock allocation system
 * Allocates stock to orders based on creation time (FIFO)
 */

interface OrderItemAllocation {
  orderId: string;
  itemId: string;
  orderedQty: number;
  allocatedQty: number;
  shortfallQty: number;
}

interface AllocationResult {
  orderAllocations: Map<string, OrderItemAllocation[]>;
}

/**
 * Calculate priority-based stock allocation for all active orders
 * Orders are processed in creation order (oldest first)
 */
export async function calculateStockAllocation(
  db: PrismaClient
): Promise<AllocationResult> {
  // Get all OPEN and HOLD orders sorted by creation time (priority)
  const activeOrders = await db.salesOrder.findMany({
    where: {
      status: {
        in: ['OPEN', 'HOLD'],
      },
    },
    include: {
      items: {
        include: {
          item: {
            select: {
              id: true,
              inventory: {
                select: {
                  physicalStock: true,
                  reservedQuantity: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'asc', // Oldest first (highest priority)
    },
  });

  // Build a map of available stock per item
  const itemStockMap = new Map<string, number>();

  // Initialize with physical stock for each item
  activeOrders.forEach((order) => {
    order.items.forEach((orderItem) => {
      const itemId = orderItem.itemId;
      if (!itemStockMap.has(itemId)) {
        const physicalStock = Number(orderItem.item.inventory?.physicalStock || 0);
        itemStockMap.set(itemId, physicalStock);
      }
    });
  });

  // Allocate stock to orders in priority order
  const orderAllocations = new Map<string, OrderItemAllocation[]>();

  activeOrders.forEach((order) => {
    const allocations: OrderItemAllocation[] = [];

    order.items.forEach((orderItem) => {
      const itemId = orderItem.itemId;
      const orderedQty = Number(orderItem.quantity);
      const availableStock = itemStockMap.get(itemId) || 0;

      // Allocate as much as possible
      const allocatedQty = Math.min(orderedQty, Math.max(0, availableStock));
      const shortfallQty = orderedQty - allocatedQty;

      // Update remaining stock
      itemStockMap.set(itemId, availableStock - allocatedQty);

      allocations.push({
        orderId: order.id,
        itemId,
        orderedQty,
        allocatedQty,
        shortfallQty,
      });
    });

    orderAllocations.set(order.id, allocations);
  });

  return {
    orderAllocations,
  };
}

/**
 * Get allocation details for a specific order
 */
export function getOrderAllocation(
  orderId: string,
  allocationResult: AllocationResult
): OrderItemAllocation[] {
  return allocationResult.orderAllocations.get(orderId) || [];
}

/**
 * Calculate stock status for an order based on allocation
 */
export function calculateOrderStockStatus(
  allocations: OrderItemAllocation[]
): 'Available' | 'Partial' | 'Unavailable' {
  if (allocations.length === 0) return 'Available';

  const allFullyAllocated = allocations.every((a) => a.shortfallQty === 0);
  const someAllocated = allocations.some((a) => a.allocatedQty > 0);

  if (allFullyAllocated) {
    return 'Available';
  } else if (someAllocated) {
    return 'Partial';
  } else {
    return 'Unavailable';
  }
}
