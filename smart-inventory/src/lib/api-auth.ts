import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { RolePermissions, PermissionKey } from '@/types/permissions';

export type PermissionLevel = 'view' | 'edit';

/**
 * Check authentication and page-level permission for an API route.
 *
 * Usage:
 *   const { error, session } = await checkPermission('sales_orders', 'view');
 *   if (error) return error;
 *   // session is guaranteed non-null here
 */
export async function checkPermission(permissionKey: PermissionKey, level: PermissionLevel = 'view') {
  const session = await auth();

  if (!session?.user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      session: null as never,
    };
  }

  const permissions = session.user.permissions as RolePermissions | undefined;

  if (!permissions?.[permissionKey]?.view) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      session: null as never,
    };
  }

  if (level === 'edit' && !permissions[permissionKey]?.edit) {
    return {
      error: NextResponse.json({ error: 'Forbidden — edit permission required' }, { status: 403 }),
      session: null as never,
    };
  }

  return { error: null, session };
}

/**
 * Check authentication only (no page permission check).
 * Use for routes that any authenticated user can access (e.g., /api/upload, /api/search).
 */
export async function checkAuth() {
  const session = await auth();

  if (!session?.user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      session: null as never,
    };
  }

  return { error: null, session };
}
