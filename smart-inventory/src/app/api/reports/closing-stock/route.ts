import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/reports/closing-stock - Get closing stock report data
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const brandId = searchParams.get('brandId') || '';
    const subBrandId = searchParams.get('subBrandId') || '';
    const hideZeroStock = searchParams.get('hideZeroStock') === 'true';

    // Build where clause
    const where: any = { isActive: true };
    if (brandId) where.brandId = brandId;
    if (subBrandId) where.subBrandId = subBrandId;

    const items = await db.item.findMany({
      where,
      include: {
        brand: { select: { id: true, name: true } },
        subBrand: { select: { id: true, name: true } },
        inventory: true,
      },
      orderBy: { name: 'asc' },
    });

    // Compute stock data
    const stockItems = [];

    for (const item of items) {
      const physicalStock = Number(item.inventory?.physicalStock ?? 0);
      const reservedQuantity = Number(item.inventory?.reservedQuantity ?? 0);
      const availableStock = physicalStock - reservedQuantity;
      const purchasePrice = Number(item.purchasePrice);
      const stockValue = availableStock * purchasePrice;

      if (hideZeroStock && availableStock <= 0) continue;

      stockItems.push({
        id: item.id,
        itemCode: item.itemCode,
        userCode: item.userCode,
        name: item.name,
        brand: item.brand?.name || 'N/A',
        brandId: item.brandId,
        subBrand: item.subBrand?.name || 'N/A',
        subBrandId: item.subBrandId,
        hsnCode: item.hsnCode || '',
        unit: item.unit,
        purchasePrice,
        physicalStock,
        reservedQuantity,
        availableStock,
        stockValue,
      });
    }

    const totalItems = stockItems.length;
    const totalQuantity = stockItems.reduce((sum, i) => sum + i.availableStock, 0);
    const totalValue = stockItems.reduce((sum, i) => sum + i.stockValue, 0);

    return NextResponse.json({
      items: stockItems,
      summary: { totalItems, totalQuantity, totalValue },
    });
  } catch (error) {
    console.error('Error fetching closing stock report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch closing stock report' },
      { status: 500 }
    );
  }
}
