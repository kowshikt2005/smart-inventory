import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { generateReturnNumber } from '@/lib/invoice-utils';
import { calculateTax } from '@/lib/order-utils';

// GET /api/sales-returns - Get all sales returns with filtering
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const customerId = searchParams.get('customerId') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '15');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (search) {
      where.OR = [
        { returnNumber: { contains: search } },
        { customer: { name: { contains: search } } },
        { customer: { customerNumber: { contains: search } } },
        { invoice: { invoiceNumber: { contains: search } } },
      ];
    }

    // Get sales returns with relations
    const [salesReturns, total] = await Promise.all([
      db.salesReturn.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              customerNumber: true,
              name: true,
            },
          },
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
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
        skip,
        take: limit,
        orderBy: { returnDate: 'desc' },
      }),
      db.salesReturn.count({ where }),
    ]);

    return NextResponse.json({
      salesReturns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching sales returns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales returns' },
      { status: 500 }
    );
  }
}

// POST /api/sales-returns - Create a new sales return
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

    if (!body.invoiceId) {
      return NextResponse.json(
        { error: 'Invoice is required' },
        { status: 400 }
      );
    }

    if (!body.returnDate) {
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

    // Validate customer exists
    const customer = await db.customer.findUnique({
      where: { id: body.customerId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Validate invoice
    const invoice = await db.invoice.findUnique({
      where: { id: body.invoiceId },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    if (invoice.customerId !== body.customerId) {
      return NextResponse.json(
        { error: 'Invoice does not belong to this customer' },
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

    // Create sales return in transaction
    const salesReturn = await transaction(async (tx) => {
      // Generate return number
      const returnNumber = await generateReturnNumber(tx as any);

      // Calculate item totals
      let subtotal = 0;
      let totalTax = 0;

      const returnItems = body.items.map((returnItem: any) => {
        const item = items.find((i) => i.id === returnItem.itemId)!;
        const taxRate = Number(item.gstRate);
        const quantity = returnItem.quantity;
        const rate = returnItem.rate;
        const amount = quantity * rate;
        const { taxAmount } = calculateTax(amount, taxRate);

        subtotal += amount;
        totalTax += taxAmount;

        return {
          itemId: returnItem.itemId,
          quantity,
          rate,
          taxRate,
          taxAmount,
          amount,
        };
      });

      const cgst = totalTax / 2;
      const sgst = totalTax / 2;
      const totalAmount = subtotal + totalTax;

      // Create the sales return
      const newReturn = await tx.salesReturn.create({
        data: {
          returnNumber,
          returnDate: new Date(body.returnDate),
          customerId: body.customerId,
          invoiceId: body.invoiceId,
          subtotal,
          cgst,
          sgst,
          taxAmount: totalTax,
          totalAmount,
          reason: body.reason || null,
          status: 'OPEN',
          items: {
            create: returnItems,
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
                },
              },
            },
          },
        },
      });

      return newReturn;
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    return NextResponse.json(salesReturn, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating sales return:', error);

    const prismaError = error as { code?: string; message?: string };

    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Return number already exists' },
        { status: 409 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to create sales return';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
