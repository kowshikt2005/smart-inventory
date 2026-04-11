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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');

    if (!entityType) {
      return NextResponse.json({ error: 'entityType is required' }, { status: 400 });
    }

    const permissionKey = getPermissionKeyForEntityType(entityType);
    if (!permissionKey) {
      return NextResponse.json({ error: `Invalid entity type: ${entityType}` }, { status: 400 });
    }

    const { error } = await checkPermission(permissionKey, 'view');
    if (error) return error;

    const mappings = await db.importMapping.findMany({
      where: { entityType },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ mappings });
  } catch (error) {
    console.error('Error fetching import mappings:', error);
    return NextResponse.json({ error: 'Failed to fetch mappings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { entityType, name, mapping } = body;

    if (!entityType || !name || !mapping) {
      return NextResponse.json({ error: 'entityType, name, and mapping are required' }, { status: 400 });
    }

    const permissionKey = getPermissionKeyForEntityType(entityType);
    if (!permissionKey) {
      return NextResponse.json({ error: `Invalid entity type: ${entityType}` }, { status: 400 });
    }

    const { error: postErr } = await checkPermission(permissionKey, 'edit');
    if (postErr) return postErr;

    const created = await db.importMapping.create({
      data: { entityType, name, mapping },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A mapping with this name already exists for this entity type' }, { status: 409 });
    }
    console.error('Error creating import mapping:', error);
    return NextResponse.json({ error: 'Failed to create mapping' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, mapping } = body;

    if (!id || !mapping) {
      return NextResponse.json({ error: 'id and mapping are required' }, { status: 400 });
    }

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

    const { error: putErr } = await checkPermission(permissionKey, 'edit');
    if (putErr) return putErr;

    const updated = await db.importMapping.update({
      where: { id },
      data: { ...(name && { name }), mapping },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating import mapping:', error);
    return NextResponse.json({ error: 'Failed to update mapping' }, { status: 500 });
  }
}
