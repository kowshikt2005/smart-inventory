import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/items/migrate-mrp - One-time migration to set mrp and sellingPrice from standardPrice
export async function POST() {
  try {
    // Find all items that need migration (where mrp or sellingPrice is 0 but standardPrice has value)
    const itemsToUpdate = await db.item.findMany({
      select: {
        id: true,
        mrp: true,
        sellingPrice: true,
        // @ts-expect-error - standardPrice might still exist in DB during migration
        standardPrice: true
      },
    });

    let updatedCount = 0;
    const updates = [];

    for (const item of itemsToUpdate) {
      // @ts-expect-error - standardPrice might still exist
      const standardPrice = Number(item.standardPrice || 0);
      const currentMrp = Number(item.mrp || 0);
      const currentSellingPrice = Number(item.sellingPrice || 0);

      // If standardPrice has a value but mrp/sellingPrice don't, migrate the data
      if (standardPrice > 0 && (currentMrp === 0 || currentSellingPrice === 0)) {
        updates.push(
          db.item.update({
            where: { id: item.id },
            data: {
              mrp: currentMrp === 0 ? standardPrice : currentMrp,
              sellingPrice: currentSellingPrice === 0 ? standardPrice : currentSellingPrice,
            },
          })
        );
        updatedCount++;
      }
    }

    if (updates.length > 0) {
      await db.$transaction(updates);
    }

    return NextResponse.json({
      message: `Successfully migrated ${updatedCount} items`,
      updatedCount,
      totalItems: itemsToUpdate.length,
    });
  } catch (error) {
    console.error('Error migrating items:', error);
    return NextResponse.json(
      { error: 'Failed to migrate items' },
      { status: 500 }
    );
  }
}
