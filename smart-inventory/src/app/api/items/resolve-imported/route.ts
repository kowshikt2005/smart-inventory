import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';

// GET /api/items/resolve-imported - Count unresolved imported items
export async function GET() {
  try {
    const { error } = await checkPermission('masters_items', 'view');
    if (error) return error;

    const count = await db.item.count({
      where: { isImported: true, brandId: null },
    });

    const items = await (db.item.findMany as any)({
      where: { isImported: true, brandId: null },
      select: { id: true, name: true, importedBrandName: true, importedSubBrandName: true },
    });

    return NextResponse.json({ count, items });
  } catch (error) {
    console.error('Error fetching unresolved items:', error);
    return NextResponse.json({ error: 'Failed to fetch unresolved items' }, { status: 500 });
  }
}

// POST /api/items/resolve-imported - Auto-create missing brands/sub-brands and link items
export async function POST() {
  try {
    const { error } = await checkPermission('masters_items', 'edit');
    if (error) return error;

    const unresolvedItems = await (db.item.findMany as any)({
      where: { isImported: true, brandId: null },
      select: { id: true, importedBrandName: true, importedSubBrandName: true },
    });

    if (unresolvedItems.length === 0) {
      return NextResponse.json({ message: 'No unresolved items found', resolved: 0 });
    }

    let resolved = 0;
    const created: { brands: string[]; subBrands: string[] } = { brands: [], subBrands: [] };

    await transaction(async (tx) => {
      // Group items by brand name
      const brandGroups = new Map<string, { id: string; importedSubBrandName: string | null }[]>();
      for (const item of unresolvedItems) {
        const bName = item.importedBrandName || 'Unknown Brand';
        if (!brandGroups.has(bName)) brandGroups.set(bName, []);
        brandGroups.get(bName)!.push(item);
      }

      for (const [brandName, items] of brandGroups) {
        // Find or create brand (skip if name is blank)
        if (!brandName.trim()) continue;
        let brand = await tx.brand.findUnique({ where: { name: brandName } });
        if (!brand) {
          brand = await tx.brand.create({ data: { name: brandName } });
          created.brands.push(brandName);
        }

        // Group items by sub-brand name — null/empty falls back to brand name
        const sbGroups = new Map<string, string[]>();
        for (const item of items) {
          const sbName = item.importedSubBrandName?.trim() || brandName;
          if (!sbGroups.has(sbName)) sbGroups.set(sbName, []);
          sbGroups.get(sbName)!.push(item.id);
        }

        for (const [sbName, itemIds] of sbGroups) {
          // Find or create sub-brand
          let subBrand = await tx.subBrand.findFirst({ where: { name: sbName, brandId: brand.id } });
          if (!subBrand) {
            subBrand = await tx.subBrand.create({ data: { name: sbName, brandId: brand.id } });
            created.subBrands.push(`${brandName} / ${sbName}`);
          }

          // Link items to brand + sub-brand
          await (tx.item.updateMany as any)({
            where: { id: { in: itemIds } },
            data: {
              brandId: brand.id,
              subBrandId: subBrand.id,
              importedBrandName: null,
              importedSubBrandName: null,
            },
          });

          resolved += itemIds.length;
        }
      }
    });

    return NextResponse.json({
      message: `Resolved ${resolved} item${resolved !== 1 ? 's' : ''}`,
      resolved,
      created,
    });
  } catch (error) {
    console.error('Error resolving imported items:', error);
    return NextResponse.json({ error: 'Failed to resolve imported items' }, { status: 500 });
  }
}
