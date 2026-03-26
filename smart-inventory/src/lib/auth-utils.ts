import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import type { RolePermissions, PermissionKey } from '@/types/permissions';

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate the next employee number in sequence (EMP-0001, EMP-0002, etc.)
 * Pass the Prisma transaction client so this runs on the same connection as
 * the surrounding employee INSERT — the @unique constraint prevents duplicates.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function generateEmployeeNumber(client?: { employee: { findFirst: (...args: any[]) => Promise<any> } }): Promise<string> {
  const c = client || db;
  const lastEmployee = await c.employee.findFirst({
    orderBy: { employeeNumber: 'desc' },
    select: { employeeNumber: true },
  });

  let nextNum = 1;
  if (lastEmployee) {
    const match = lastEmployee.employeeNumber.match(/EMP-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `EMP-${String(nextNum).padStart(4, '0')}`;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Check if a role's permissions grant view access to a page
 */
export function hasViewPermission(permissions: RolePermissions | undefined, page: PermissionKey): boolean {
  return permissions?.[page]?.view === true;
}

/**
 * Check if a role's permissions grant edit access to a page
 */
export function hasEditPermission(permissions: RolePermissions | undefined, page: PermissionKey): boolean {
  return permissions?.[page]?.edit === true;
}

/**
 * Fetch a role with its permissions from the database
 */
export async function getRoleById(roleId: string) {
  return db.role.findUnique({
    where: { id: roleId },
    select: { id: true, name: true, permissions: true, isSystem: true },
  });
}

/**
 * Check if a roleId belongs to the system ADMIN role
 */
export async function isSystemAdmin(roleId: string): Promise<boolean> {
  const role = await db.role.findUnique({
    where: { id: roleId },
    select: { name: true, isSystem: true },
  });
  return role?.name === 'ADMIN' && role?.isSystem === true;
}

// ---- Backward compatibility (used during migration transition) ----

/**
 * @deprecated Use hasViewPermission / hasEditPermission instead.
 * Kept temporarily for code that hasn't been migrated yet.
 */
export function hasRole(userRole: string, requiredRole: string): boolean {
  const roleHierarchy: Record<string, number> = {
    'SALESMAN': 1,
    'BILLING_OPERATOR': 2,
    'ACCOUNTANT': 3,
    'MANAGER': 4,
    'ADMIN': 5,
  };

  const userLevel = roleHierarchy[userRole] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  return userLevel >= requiredLevel;
}

/**
 * @deprecated Use role.permissions from DB instead.
 */
export function getRolePermissions(role: string) {
  const permissions = {
    ADMIN: {
      canManageEmployees: true,
      canViewReports: true,
      canManageInvoices: true,
      canManageOrders: true,
      canManageCustomers: true,
      canManageInventory: true,
    },
    MANAGER: {
      canManageEmployees: false,
      canViewReports: true,
      canManageInvoices: true,
      canManageOrders: true,
      canManageCustomers: true,
      canManageInventory: true,
    },
    ACCOUNTANT: {
      canManageEmployees: false,
      canViewReports: true,
      canManageInvoices: true,
      canManageOrders: false,
      canManageCustomers: false,
      canManageInventory: false,
    },
    BILLING_OPERATOR: {
      canManageEmployees: false,
      canViewReports: false,
      canManageInvoices: true,
      canManageOrders: true,
      canManageCustomers: false,
      canManageInventory: false,
    },
    SALESMAN: {
      canManageEmployees: false,
      canViewReports: false,
      canManageInvoices: false,
      canManageOrders: true,
      canManageCustomers: false,
      canManageInventory: false,
    },
  };

  return permissions[role as keyof typeof permissions] || permissions.SALESMAN;
}
