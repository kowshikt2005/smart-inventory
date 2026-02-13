import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { generatePurchaseReturnNumber, calculatePurchaseLineItem, calculatePurchaseTotals } from '@/lib/purchase-utils';

// GET /api/purchase-returns - Get all purchase returns with filtering
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const vendorId = searchParams.get('vendorId') || '';
    const purchaseInvoiceId = searchParams.get('purchaseInvoiceId') || '';
    const brandId = searchParams.get('brandId') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '15');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (vendorId) {
      where.vendorId = vendorId;
    }

    if (purchaseInvoiceId) {
      where.purchaseInvoiceId = purchaseInvoiceId;
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
        { returnNumber: { contains: search } },
        { vendorName: { contains: search } },
        { vendor: { vendorNumber: { contains: search } } },
      ];
    }

    // Get purchase returns with relations
    const [purchaseReturns, total] = await Promise.all([
      db.purchaseReturn.findMany({
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
          purchaseInvoice: {
            select: {
              id: true,
              invoiceNumber: true,
              totalAmount: true,
              status: true,
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
        },
        skip,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      db.purchaseReturn.count({ where }),
    ]);

    return NextResponse.json({
      purchaseReturns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching purchase returns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase returns' },
      { status: 500 }
    );
  }
}

// POST /api/purchase-returns - Create a new purchase return
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
        { error: 'Return date is required' },
        { status: 400 }
      );
    }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: 'At least one item is required' },
        { status: 400 }
      );
    }

    // Validate return date is not in the future
    const returnDate = new Date(body.date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (returnDate > today) {
      return NextResponse.json(
        { error: 'Return date cannot be in the future' },
        { status: 400 }
      );
    }

    // Validate vendor exists
    const vendor = await db.vendor.findUnique({
      where: { id: body.vendorId },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    // Validate purchase invoice if provided
    let purchaseInvoice = null;
    if (body.purchaseInvoiceId) {
      purchaseInvoice = await db.purchaseInvoice.findUnique({
        where: { id: body.purchaseInvoiceId },
      });

      if (!purchaseInvoice) {
        return NextResponse.json(
          { error: 'Purchase invoice not found' },
          { status: 404 }
        );
      }

      if (purchaseInvoice.vendorId !== body.vendorId) {
        return NextResponse.json(
          { error: 'Purchase invoice belongs to a different vendor' },
          { status: 400 }
        );
      }

      if (purchaseInvoice.status === 'CANCELLED') {
        return NextResponse.json(
          { error: 'Cannot create return for cancelled invoice' },
          { status: 400 }
        );
      }
    }

    // Validate all items exist
    const itemIds = body.items.map((item: any) => item.itemId);
    const items = await db.item.findMany({
      where: { id: { in: itemIds } },
      include: { inventory: true },
    });

    if (items.length !== itemIds.length) {
      return NextResponse.json(
        { error: 'One or more items not found' },
        { status: 400 }
      );
    }

    // Validate quantities and rates
    for (const returnItem of body.items) {
      if (!returnItem.quantity || returnItem.quantity <= 0) {
        return NextResponse.json(
          { error: 'All quantities must be greater than 0' },
          { status: 400 }
        );
      }
      if (!returnItem.rate || returnItem.rate <= 0) {
        return NextResponse.json(
          { error: 'All rates must be greater than 0' },
          { status: 400 }
        );
      }
    }

    // Create return in a transaction
    const purchaseReturn = await transaction(async (tx) => {
      // Generate return number
      const returnNumber = await generatePurchaseReturnNumber(tx as any);

      // Calculate item totals
      const returnItems = body.items.map((returnItem: any) => {
        const item = items.find((i) => i.id === returnItem.itemId)!;
        const taxRate = returnItem.taxRate ?? Number(item.gstRate);
        const { amount, taxAmount } = calculatePurchaseLineItem(
          returnItem.quantity,
          returnItem.rate,
          taxRate
        );

        return {
          itemId: returnItem.itemId,
          quantity: returnItem.quantity,
          rate: returnItem.rate,
          taxRate,
          taxAmount,
          amount,
        };
      });

      // Calculate return totals
      const { subtotal, totalTax, totalAmount } = calculatePurchaseTotals(returnItems);

      // Create the purchase return
      const purchaseReturnRecord = await tx.purchaseReturn.create({
        data: {
          returnNumber,
          vendorId: body.vendorId,
          vendorName: vendor.name,
          purchaseInvoiceId: body.purchaseInvoiceId || null,
          date: new Date(body.date),
          amount: subtotal,
          taxAmount: totalTax,
          totalAmount,
          status: 'OPEN',
          reason: body.reason || null,
          notes: body.notes || null,
          items: {
            create: returnItems,
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

      return purchaseReturnRecord;
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    return NextResponse.json(purchaseReturn, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating purchase return:', error);

    const prismaError = error as { code?: string; message?: string };

    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Return number already exists' },
        { status: 409 }
      );
    }

    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        { error: 'Related record not found.' },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to create purchase return';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
