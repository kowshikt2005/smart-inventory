import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@/generated/prisma';
import { checkPermission } from '@/lib/api-auth';
import { ALL_PERMISSION_KEYS } from '@/types/permissions';
import type { RolePermissions, PagePermission } from '@/types/permissions';

// GET /api/roles/[id]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await checkPermission('masters_roles', 'view');
  if (error) return error;

  try {
    const { id } = await params;
    const role = await db.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    return NextResponse.json(role);
  } catch (err) {
    console.error('Error fetching role:', err);
    return NextResponse.json({ error: 'Failed to fetch role' }, { status: 500 });
  }
}

// PUT /api/roles/[id]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await checkPermission('masters_roles', 'edit');
  if (error) return error;

  try {
    const { id } = await params;
    const existing = await db.role.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, permissions, isActive } = body;

    // Guard: cannot rename system roles
    if (existing.isSystem && name && name !== existing.name) {
      return NextResponse.json(
        { error: 'Cannot rename system roles' },
        { status: 403 }
      );
    }

    // Guard: cannot deactivate ADMIN system role
    if (existing.isSystem && existing.name === 'ADMIN' && isActive === false) {
      return NextResponse.json(
        { error: 'Cannot deactivate the Admin role' },
        { status: 403 }
      );
    }

    // Guard: cannot reduce ADMIN permissions
    if (existing.isSystem && existing.name === 'ADMIN' && permissions) {
      return NextResponse.json(
        { error: 'Cannot modify Admin role permissions' },
        { status: 403 }
      );
    }

    // Check name uniqueness if changing
    if (name && name.trim() !== existing.name) {
      const duplicate = await db.role.findUnique({ where: { name: name.trim() } });
      if (duplicate) {
        return NextResponse.json(
          { error: 'A role with this name already exists' },
          { status: 409 }
        );
      }
    }

    // Clean permissions if provided
    let cleanPermissions: RolePermissions | undefined;
    if (permissions && typeof permissions === 'object') {
      cleanPermissions = {} as RolePermissions;
      for (const key of ALL_PERMISSION_KEYS) {
        const perm = permissions[key] as PagePermission | undefined;
        cleanPermissions[key] = {
          view: perm?.view === true,
          edit: perm?.edit === true,
        };
        if (cleanPermissions[key].edit) {
          cleanPermissions[key].view = true;
        }
      }
    }

    // Require at least one view permission
    if (cleanPermissions) {
      const hasAtLeastOneView = Object.values(cleanPermissions).some((p) => p.view === true);
      if (!hasAtLeastOneView) {
        return NextResponse.json(
          { error: 'At least one view permission must be enabled.' },
          { status: 400 }
        );
      }
    }

    const updated = await db.role.update({
      where: { id },
      data: {
        ...(name && !existing.isSystem ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(cleanPermissions ? { permissions: cleanPermissions as unknown as Prisma.InputJsonValue } : {}),
        ...(isActive !== undefined && !(existing.isSystem && existing.name === 'ADMIN')
          ? { isActive }
          : {}),
      },
      include: { _count: { select: { users: true } } },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('Error updating role:', err);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}

// DELETE /api/roles/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await checkPermission('masters_roles', 'edit');
  if (error) return error;

  try {
    const { id } = await params;
    const existing = await db.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    if (existing.isSystem) {
      return NextResponse.json(
        { error: 'Cannot delete system roles' },
        { status: 403 }
      );
    }

    if (existing._count.users > 0) {
      return NextResponse.json(
        { error: `Cannot delete role — ${existing._count.users} user(s) are assigned to it` },
        { status: 409 }
      );
    }

    await db.role.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting role:', err);
    return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
  }
}
