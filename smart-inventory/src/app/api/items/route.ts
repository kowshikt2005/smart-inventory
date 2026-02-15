import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';

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
        { userCode: { contains: search } },
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

    const [items, total] = await Promise.all([
      db.item.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          brand: true,
          subBrand: true,
          inventory: true,
        },
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
    const missing: string[] = [];
    if (!body.name) missing.push('Item Name');
    if (!body.brandId) missing.push('Brand');
    if (!body.subBrandId) missing.push('Sub-brand');

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Required fields missing: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // Generate unique item code
    const itemCode = `item-${Date.now()}`;

    // Create item with inventory record in transaction (without includes for speed)
    const newItem = await transaction(async (tx) => {
      // Create the item (without includes to keep transaction fast)
      const item = await tx.item.create({
        data: {
          itemCode: itemCode,
          userCode: body.userCode || null,
          name: body.name,
          description: body.description || null,
          brandId: body.brandId,
          subBrandId: body.subBrandId,
          hsnCode: body.hsnCode || null,
          gstRate: body.gstRate || 0,
          purchasePrice: body.purchasePrice || 0,
          mrp: body.mrp || 0,
          sellingPrice: body.sellingPrice || body.mrp || 0,
          margin: body.margin !== undefined && body.margin !== null ? body.margin : null,
          marginType: body.marginType || "PERCENTAGE",
          discountPercent: body.discountPercent || null,
          minStock: body.minStock || 0,
          unit: body.unit || 'PCS',
          imageUrl: body.imageUrl || null,
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
