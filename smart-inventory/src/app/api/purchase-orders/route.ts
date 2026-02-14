import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { generatePurchaseOrderNumber, calculatePurchaseLineItem, calculatePurchaseTotals } from '@/lib/purchase-utils';
import { auth } from '@/lib/auth';

// GET /api/purchase-orders - Get all purchase orders with filtering
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const vendorId = searchParams.get('vendorId') || '';
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

    if (vendorId) {
      where.vendorId = vendorId;
    }

    if (brandId) {
      where.items = { some: { item: { brandId } } };
    }

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.date.lte = to;
      }
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { vendorName: { contains: search } },
        { vendor: { vendorNumber: { contains: search } } },
      ];
    }

    // Get purchase orders with relations
    const [purchaseOrders, total] = await Promise.all([
      db.purchaseOrder.findMany({
        where,
        include: {
          vendor: {
            select: {
              id: true,
              vendorNumber: true,
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
                  purchasePrice: true,
                },
              },
            },
          },
          purchaseInvoices: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      db.purchaseOrder.count({ where }),
    ]);

    return NextResponse.json({
      purchaseOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase orders' },
      { status: 500 }
    );
  }
}

// POST /api/purchase-orders - Create a new purchase order
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.vendorId) {
      return NextResponse.json(
        { error: 'Vendor is required' },
        { status: 400 }
      );
    }

    if (!body.date) {
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
    const orderDate = new Date(body.date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (orderDate > today) {
      return NextResponse.json(
        { error: 'Order date cannot be in the future' },
        { status: 400 }
      );
    }

    // Validate vendor exists and is active
    const vendor = await db.vendor.findUnique({
      where: { id: body.vendorId },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    if (!vendor.isActive) {
      return NextResponse.json(
        { error: 'Cannot create order for inactive vendor' },
        { status: 400 }
      );
    }

    // Validate all items exist
    const itemIds = body.items.map((item: any) => item.itemId);
    const items = await db.item.findMany({
      where: { id: { in: itemIds } },
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

    // Create order in a transaction
    const purchaseOrder = await transaction(async (tx) => {
      // Generate order number
      const orderNumber = await generatePurchaseOrderNumber(tx as any);

      // Calculate item totals
      const orderItems = body.items.map((orderItem: any) => {
        const item = items.find((i) => i.id === orderItem.itemId)!;
        const taxRate = orderItem.taxRate ?? Number(item.gstRate);
        const { amount, taxAmount } = calculatePurchaseLineItem(
          orderItem.quantity,
          orderItem.rate,
          taxRate
        );

        return {
          itemId: orderItem.itemId,
          quantity: orderItem.quantity,
          rate: orderItem.rate,
          taxRate,
          taxAmount,
          amount,
        };
      });

      // Calculate order totals
      const { subtotal, totalTax, totalAmount } = calculatePurchaseTotals(orderItems);

      // Create the purchase order
      const order = await tx.purchaseOrder.create({
        data: {
          orderNumber,
          vendorId: body.vendorId,
          vendorName: vendor.name,
          date: new Date(body.date),
          expectedDelivery: body.expectedDelivery
            ? new Date(body.expectedDelivery)
            : null,
          amount: subtotal,
          taxAmount: totalTax,
          totalAmount,
          status: 'OPEN',
          notes: body.notes || null,
          items: {
            create: orderItems,
          },
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

      return order;
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    return NextResponse.json(purchaseOrder, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating purchase order:', error);

    const prismaError = error as { code?: string; message?: string };

    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Order number already exists' },
        { status: 409 }
      );
    }

    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        { error: 'Related record not found. Please check that all items and vendor exist.' },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to create purchase order';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
