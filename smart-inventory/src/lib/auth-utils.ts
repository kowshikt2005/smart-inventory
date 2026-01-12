import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

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
 */
export async function generateEmployeeNumber(): Promise<string> {
  const lastEmployee = await db.employee.findFirst({
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

/**
 * Check if user has required role or higher
 */
export function hasRole(userRole: string, requiredRole: string): boolean {
  const roleHierarchy = {
    'SALESMAN': 1,
    'BILLING_OPERATOR': 2,
    'ACCOUNTANT': 3,
    'MANAGER': 4,
    'ADMIN': 5,
  };

  const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;
  const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;

  return userLevel >= requiredLevel;
}

/**
 * Get permissions for a role
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