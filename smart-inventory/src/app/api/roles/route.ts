import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@/generated/prisma';
import { checkPermission } from '@/lib/api-auth';
import { ALL_PERMISSION_KEYS, fillMissingPermissions } from '@/types/permissions';
import type { RolePermissions, PagePermission } from '@/types/permissions';

// GET /api/roles — list all roles
export async function GET(request: Request) {
  const { error } = await checkPermission('masters_roles', 'view');
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const roles = await db.role.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { users: true } },
      },
    });

    // Normalize: fill missing permission keys so the Roles UI always shows every key
    const normalized = roles.map((role: typeof roles[number]) => ({
      ...role,
      permissions: fillMissingPermissions((role.permissions ?? {}) as Partial<RolePermissions>),
    }));

    return NextResponse.json(normalized);
  } catch (err) {
    console.error('Error fetching roles:', err);
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
}

// POST /api/roles — create a new role
export async function POST(request: Request) {
  const { error } = await checkPermission('masters_roles', 'edit');
  if (error) return error;

  try {
    const body = await request.json();
    const { name, description, permissions } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Role name is required' }, { status: 400 });
    }

    // Validate permissions shape
    if (!permissions || typeof permissions !== 'object') {
      return NextResponse.json({ error: 'Permissions object is required' }, { status: 400 });
    }

    // Ensure all permission keys exist and have valid shape
    const cleanPermissions: RolePermissions = {} as RolePermissions;
    for (const key of ALL_PERMISSION_KEYS) {
      const perm = permissions[key] as PagePermission | undefined;
      cleanPermissions[key] = {
        view: perm?.view === true,
        edit: perm?.edit === true,
      };
      // edit implies view
      if (cleanPermissions[key].edit) {
        cleanPermissions[key].view = true;
      }
    }

    // Check name uniqueness
    const existing = await db.role.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return NextResponse.json({ error: 'A role with this name already exists' }, { status: 409 });
    }

    const role = await db.role.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        isSystem: false,
        isActive: true,
        permissions: cleanPermissions as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(role, { status: 201 });
  } catch (err) {
    console.error('Error creating role:', err);
    return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
  }
}
