import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';
import type { EntityType } from '@/lib/import-utils';
import type { PermissionKey } from '@/types/permissions';

const IMPORT_ENTITY_PERMISSION: Record<EntityType, PermissionKey> = {
  CUSTOMER: 'masters_customers',
  VENDOR: 'masters_vendors',
  ITEM: 'masters_items',
  EMPLOYEE: 'masters_employees',
  STOCK_JOURNAL: 'ledger_stock_journal',
  PAYMENT: 'sales_receipts',
  VENDOR_PAYMENT: 'purchases_payments',
  SALES_INVOICE: 'sales_invoices',
  PURCHASE_INVOICE: 'purchases_invoices',
};

function getPermissionKeyForEntityType(entityType: string): PermissionKey | null {
  return IMPORT_ENTITY_PERMISSION[entityType as EntityType] ?? null;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existingMapping = await db.importMapping.findUnique({
      where: { id },
      select: { entityType: true },
    });

    if (!existingMapping) {
      return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }

    const permissionKey = getPermissionKeyForEntityType(existingMapping.entityType);
    if (!permissionKey) {
      return NextResponse.json({ error: `Invalid entity type: ${existingMapping.entityType}` }, { status: 400 });
    }

    const { error } = await checkPermission(permissionKey, 'edit');
    if (error) return error;

    await db.importMapping.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting import mapping:', error);
    return NextResponse.json({ error: 'Failed to delete mapping' }, { status: 500 });
  }
}
