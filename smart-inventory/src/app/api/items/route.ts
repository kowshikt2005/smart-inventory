import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/items - Get all items with optional search and pagination
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const brandId = searchParams.get('brandId') || '';
    const subBrandId = searchParams.get('subBrandId') || '';
    const isActive = searchParams.get('isActive');
    const skip = (page - 1) * limit;

    // Build where clause for search and filters
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { itemCode: { contains: search } },
        { description: { contains: search } },
        { hsnCode: { contains: search } },
      ];
    }

    if (brandId) {
      where.brandId = brandId;
    }

    if (subBrandId) {
      where.subBrandId = subBrandId;
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    // Optimize query based on limit - for large fetches, use select instead of include
    const useLightweightQuery = limit > 100;

    const [items, total] = await Promise.all([
      db.item.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        ...(useLightweightQuery
          ? {
              // Lightweight query for bulk fetches (e.g., sales order page)
              select: {
                id: true,
                itemCode: true,
                name: true,
                description: true,
                unit: true,
                hsnCode: true,
                gstRate: true,
                standardPrice: true,
                purchasePrice: true, // MRP
                mrp: true,
                discountPercent: true,
                isActive: true,
                brand: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                subBrand: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                inventory: {
                  select: {
                    physicalStock: true,
                    reservedQuantity: true,
                  },
                },
              },
            }
          : {
              // Full query for detailed views
              include: {
                brand: true,
                subBrand: true,
                inventory: true,
              },
            }),
      }),
      db.item.count({ where }),
    ]);

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    );
  }
}

// POST /api/items - Create a new item
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['name'];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Generate unique item code
    const itemCode = `item-${Date.now()}`;

    // Create item with inventory record in transaction (without includes for speed)
    const newItem = await db.$transaction(async (tx) => {
      // Create the item (without includes to keep transaction fast)
      const item = await tx.item.create({
        data: {
          itemCode: itemCode,
          name: body.name,
          description: body.description || null,
          brandId: body.brandId || null,
          subBrandId: body.subBrandId || null,
          hsnCode: body.hsnCode || null,
          gstRate: body.gstRate || 0,
          standardPrice: body.standardPrice || 0,
          purchasePrice: body.purchasePrice || 0,
          mrp: body.mrp || null,
          discountPercent: body.discountPercent || null,
          minStock: body.minStock || 0,
          unit: body.unit || 'PCS',
          isActive: body.isActive !== undefined ? body.isActive : true,
        },
      });

      // Create inventory record
      await tx.inventory.create({
        data: {
          itemId: item.id,
          physicalStock: 0,
          reservedQuantity: 0,
          minStockLevel: body.minStock || 0,
        },
      });

      return item;
    });

    // Fetch the full item with relations AFTER transaction completes
    const item = await db.item.findUnique({
      where: { id: newItem.id },
      include: {
        brand: true,
        subBrand: true,
        inventory: true,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error: any) {
    console.error('Error creating item:', error);

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Item code already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create item' },
      { status: 500 }
    );
  }
}