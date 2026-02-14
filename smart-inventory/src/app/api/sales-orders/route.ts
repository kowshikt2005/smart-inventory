import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { generateOrderNumber, calculateLineItemV2, calculateOrderTotals, SYSTEM_USER_ID } from '@/lib/order-utils';
import { calculateStockAllocation, getOrderAllocation, calculateOrderStockStatus } from '@/lib/stock-allocation';
import { auth } from '@/lib/auth';

// GET /api/sales-orders - Get all sales orders with filtering
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const customerId = searchParams.get('customerId') || '';
    const brandId = searchParams.get('brandId') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '15');
    const skip = (page - 1) * limit;

    await auth();

    // Build where clause
    const where: any = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (brandId) {
      where.items = { some: { item: { brandId } } };
    }

    if (dateFrom || dateTo) {
      where.orderDate = {};
      if (dateFrom) where.orderDate.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.orderDate.lte = to;
      }
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { referenceNumber: { contains: search } },
        { customer: { name: { contains: search } } },
        { customer: { customerNumber: { contains: search } } },
      ];
    }

    // Get sales orders with relations
    const [salesOrders, total] = await Promise.all([
      db.salesOrder.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              customerNumber: true,
              name: true,
              gstin: true,
              city: true,
              state: true,
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
                  sellingPrice: true,
                  mrp: true,
                  discountPercent: true,
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
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { orderDate: 'desc' },
      }),
      db.salesOrder.count({ where }),
    ]);

    // Calculate priority-based stock allocation
    const allocationResult = await calculateStockAllocation(db);

    // Add stock status to each order based on priority allocation
    const ordersWithStockStatus = salesOrders.map((order) => {
      // Get allocation for this order
      const allocations = getOrderAllocation(order.id, allocationResult);
      const allocationMap = new Map(
        allocations.map((a) => [a.itemId, a])
      );

      // Calculate stock status based on allocation
      const stockStatus = calculateOrderStockStatus(allocations);

      const itemsWithStock = order.items.map((orderItem) => {
        const allocation = allocationMap.get(orderItem.itemId);
        const allocatedQty = allocation?.allocatedQty || 0;
        const shortfallQty = allocation?.shortfallQty || 0;
        const hasStock = shortfallQty === 0;

        return {
          ...orderItem,
          hasStock,
          availableStock: allocatedQty,
          allocatedQty,
          shortfallQty,
        };
      });

      // Create summary for stock
      const stockSummary = {
        totalItems: itemsWithStock.length,
        availableItems: itemsWithStock.filter((item) => item.hasStock).length,
        partialItems: itemsWithStock.filter(
          (item) => !item.hasStock && item.allocatedQty > 0
        ).length,
        unavailableItems: itemsWithStock.filter(
          (item) => item.allocatedQty === 0
        ).length,
      };

      // For Partial/Unavailable orders, include detailed item stock info
      let itemStockDetails = undefined;
      if (stockStatus === 'Partial' || stockStatus === 'Unavailable') {
        itemStockDetails = itemsWithStock
          .filter((item) => !item.hasStock)
          .map((item) => ({
            itemId: item.itemId,
            itemCode: item.item.itemCode,
            itemName: item.item.name,
            orderedQty: Number(item.quantity),
            availableQty: item.allocatedQty,
            missingQty: item.shortfallQty,
            unit: item.item.unit,
          }));
      }

      return {
        ...order,
        stockStatus,
        stockSummary,
        itemStockDetails,
        items: itemsWithStock,
      };
    });

    return NextResponse.json({
      salesOrders: ordersWithStockStatus,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching sales orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales orders' },
      { status: 500 }
    );
  }
}

// POST /api/sales-orders - Create a new sales order
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.customerId) {
      return NextResponse.json(
        { error: 'Customer is required' },
        { status: 400 }
      );
    }

    if (!body.orderDate) {
      return NextResponse.json(
        { error: 'Order date is required' },
        { status: 400 }
      );
    }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: 'At least one item is required' },
        { status: 400 }
      );
    }

    // Validate order date is not in the future
    const orderDate = new Date(body.orderDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (orderDate > today) {
      return NextResponse.json(
        { error: 'Order date cannot be in the future' },
        { status: 400 }
      );
    }

    // Validate customer exists and is active
    const customer = await db.customer.findUnique({
      where: { id: body.customerId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    if (customer.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Cannot create order for inactive customer' },
        { status: 400 }
      );
    }

    // Validate all items exist and quantities are valid
    const itemIds = body.items.map((item: any) => item.itemId);
    const items = await db.item.findMany({
      where: { id: { in: itemIds } },
      include: {
        inventory: true,
      },
    });

    if (items.length !== itemIds.length) {
      return NextResponse.json(
        { error: 'One or more items not found' },
        { status: 400 }
      );
    }

    // Validate quantities and rates
    for (const orderItem of body.items) {
      if (!orderItem.quantity || orderItem.quantity <= 0) {
        return NextResponse.json(
          { error: 'All quantities must be greater than 0' },
          { status: 400 }
        );
      }
      if (!orderItem.rate || orderItem.rate <= 0) {
        return NextResponse.json(
          { error: 'All rates must be greater than 0' },
          { status: 400 }
        );
      }
    }

    // Check stock availability and warn if insufficient (non-blocking)
    const insufficientStockItems = [];
    for (const orderItem of body.items) {
      const item = items.find((i) => i.id === orderItem.itemId);
      if (!item) continue;

      const physicalStock = Number(item.inventory?.physicalStock || 0);
      const reservedQuantity = Number(item.inventory?.reservedQuantity || 0);
      const availableStock = physicalStock - reservedQuantity;
      const requiredQty = Number(orderItem.quantity);

      if (availableStock < requiredQty) {
        insufficientStockItems.push({
          itemId: item.id,
          itemCode: item.itemCode,
          itemName: item.name,
          required: requiredQty,
          available: availableStock,
          shortfall: requiredQty - availableStock,
        });
      }
    }

    // If stock is insufficient and user hasn't confirmed, return warning
    if (insufficientStockItems.length > 0 && !body.forceCreate) {
      return NextResponse.json(
        {
          warning: true,
          message: 'Some items have insufficient stock',
          insufficientStock: insufficientStockItems,
        },
        { status: 409 }
      );
    }

    // Validate round off is within range
    const roundOff = body.roundOff || 0;
    if (roundOff < -1 || roundOff > 1) {
      return NextResponse.json(
        { error: 'Round off must be between -1.00 and +1.00' },
        { status: 400 }
      );
    }

    // Ensure system user exists
    let systemUser = await db.user.findUnique({
      where: { id: SYSTEM_USER_ID },
    });

    if (!systemUser) {
      // Create system user if not exists
      systemUser = await db.user.create({
        data: {
          id: SYSTEM_USER_ID,
          email: 'system@ledgerzen.local',
          name: 'System',
          password: 'not-for-login',
          role: 'ADMIN',
          isActive: true,
        },
      });
    }

    // Create order in a transaction with extended timeout
    const salesOrder = await transaction(async (tx) => {
      // Generate order number
      const orderNumber = await generateOrderNumber(tx as any);

      // Calculate item totals using V2 which handles both inclusive and exclusive GST
      const orderItems = body.items.map((orderItem: any) => {
        const item = items.find((i) => i.id === orderItem.itemId)!;
        const taxRate = Number(item.gstRate);
        const discountPercent = orderItem.discountPercent || 0;
        const { amount, taxAmount } = calculateLineItemV2(
          orderItem.quantity,
          orderItem.rate,
          taxRate,
          discountPercent
        );

        return {
          itemId: orderItem.itemId,
          quantity: orderItem.quantity,
          rate: orderItem.rate,
          discountPercent,
          taxRate,
          taxAmount,
          amount,
        };
      });

      // Calculate order totals
      const { subtotal, totalTax, totalAmount } = calculateOrderTotals(
        orderItems,
        roundOff
      );

      // Create the sales order
      const order = await tx.salesOrder.create({
        data: {
          orderNumber,
          orderDate: new Date(body.orderDate),
          customerId: body.customerId,
          expectedDelivery: body.expectedDelivery
            ? new Date(body.expectedDelivery)
            : null,
          referenceNumber: body.referenceNumber || null,
          status: 'OPEN',
          subtotal,
          discountAmount: body.discountAmount || 0,
          taxAmount: totalTax,
          totalAmount,
          notes: body.notes || null,
          terms: body.terms || null,
          createdBy: SYSTEM_USER_ID,
          items: {
            create: orderItems,
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
            include: {
              item: {
                select: {
                  id: true,
                  itemCode: true,
                  name: true,
                  unit: true,
                  mrp: true,
                  discountPercent: true,
                },
              },
            },
          },
        },
      });

      // Reserve inventory for each item (only if inventory record exists) - OPTIMIZED
      const itemIds = orderItems.map((item: any) => item.itemId);
      const inventories = await tx.inventory.findMany({
        where: { itemId: { in: itemIds } },
      });
      const inventoryMap = new Map(inventories.map(inv => [inv.itemId, inv]));

      // Prepare batch inventory updates
      const inventoryUpdates = orderItems
        .filter((orderItem: any) => inventoryMap.has(orderItem.itemId))
        .map((orderItem: any) => 
          tx.inventory.update({
            where: { itemId: orderItem.itemId },
            data: {
              reservedQuantity: {
                increment: orderItem.quantity,
              },
            },
          })
        );

      // Execute inventory updates and status history in parallel
      await Promise.all([
        ...inventoryUpdates,
        tx.orderStatusHistory.create({
          data: {
            salesOrderId: order.id,
            fromStatus: null,
            toStatus: 'OPEN',
            reason: 'Order created',
            changedBy: SYSTEM_USER_ID,
          },
        }),
      ]);

      return order;
    }, {
      maxWait: 10000, // 10 seconds max wait to acquire connection
      timeout: 30000, // 30 seconds transaction timeout
    });

    return NextResponse.json(salesOrder, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating sales order:', error);

    // Type-safe error handling
    const prismaError = error as { code?: string; message?: string };

    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Order number already exists' },
        { status: 409 }
      );
    }

    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        { error: 'Related record not found. Please check that all items and customer exist.' },
        { status: 400 }
      );
    }

    // Return more detailed error in development
    const errorMessage = error instanceof Error ? error.message : 'Failed to create sales order';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
