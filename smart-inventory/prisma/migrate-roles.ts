/**
 * Migration script: Create default roles and assign roleId to existing users.
 * Run ONCE after `npx prisma db push && npx prisma generate` (Phase 1 schema).
 *
 * Usage: npx tsx prisma/migrate-roles.ts
 */

import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

// Permission keys for all pages
type PagePerm = { view: boolean; edit: boolean };
type Perms = Record<string, PagePerm>;

const none: PagePerm = { view: false, edit: false };
const viewOnly: PagePerm = { view: true, edit: false };
const full: PagePerm = { view: true, edit: true };

function buildPermissions(overrides: Record<string, PagePerm>): Perms {
  const allKeys = [
    'dashboard',
    'sales_orders', 'sales_invoices', 'sales_dummy_invoices', 'sales_receipts', 'sales_returns',
    'purchases_orders', 'purchases_reorders', 'purchases_invoices', 'purchases_payments', 'purchases_returns',
    'bank_accounts', 'bank_ledger',
    'ledger_customers', 'ledger_vendors', 'ledger_stock', 'ledger_stock_journal',
    'reports',
    'masters_customers', 'masters_vendors', 'masters_employees', 'masters_rate_sheets', 'masters_items', 'masters_roles',
    'settings',
  ];

  const perms: Perms = {};
  for (const key of allKeys) {
    perms[key] = overrides[key] ?? none;
  }
  return perms;
}

const DEFAULT_ROLES: { name: string; description: string; permissions: Perms }[] = [
  {
    name: 'ADMIN',
    description: 'Full system access — all permissions',
    permissions: buildPermissions({
      dashboard: full,
      sales_orders: full, sales_invoices: full, sales_dummy_invoices: full, sales_receipts: full, sales_returns: full,
      purchases_orders: full, purchases_reorders: full, purchases_invoices: full, purchases_payments: full, purchases_returns: full,
      bank_accounts: full, bank_ledger: full,
      ledger_customers: full, ledger_vendors: full, ledger_stock: full, ledger_stock_journal: full,
      reports: full,
      masters_customers: full, masters_vendors: full, masters_employees: full, masters_rate_sheets: full, masters_items: full, masters_roles: full,
      settings: full,
    }),
  },
  {
    name: 'MANAGER',
    description: 'All access except role management',
    permissions: buildPermissions({
      dashboard: full,
      sales_orders: full, sales_invoices: full, sales_dummy_invoices: full, sales_receipts: full, sales_returns: full,
      purchases_orders: full, purchases_reorders: full, purchases_invoices: full, purchases_payments: full, purchases_returns: full,
      bank_accounts: full, bank_ledger: full,
      ledger_customers: full, ledger_vendors: full, ledger_stock: full, ledger_stock_journal: full,
      reports: full,
      masters_customers: full, masters_vendors: full, masters_employees: viewOnly, masters_rate_sheets: full, masters_items: full,
      settings: full,
    }),
  },
  {
    name: 'ACCOUNTANT',
    description: 'Sales, ledger, reports, and read-only masters',
    permissions: buildPermissions({
      dashboard: viewOnly,
      sales_orders: viewOnly, sales_invoices: full, sales_dummy_invoices: full, sales_receipts: full, sales_returns: full,
      bank_accounts: full, bank_ledger: full,
      ledger_customers: full, ledger_vendors: full, ledger_stock: full, ledger_stock_journal: full,
      reports: full,
      masters_customers: viewOnly, masters_vendors: viewOnly, masters_rate_sheets: viewOnly, masters_items: viewOnly,
    }),
  },
  {
    name: 'BILLING_OPERATOR',
    description: 'Sales transactions and basic reporting',
    permissions: buildPermissions({
      dashboard: viewOnly,
      sales_orders: full, sales_invoices: full, sales_dummy_invoices: full, sales_receipts: full, sales_returns: full,
      bank_accounts: viewOnly, bank_ledger: viewOnly,
      ledger_customers: viewOnly, ledger_vendors: viewOnly, ledger_stock: viewOnly, ledger_stock_journal: viewOnly,
      reports: viewOnly,
    }),
  },
  {
    name: 'SALESMAN',
    description: 'Sales orders only',
    permissions: buildPermissions({
      dashboard: viewOnly,
      sales_orders: full, sales_invoices: viewOnly,
    }),
  },
];

async function main() {
  console.log('=== Role Migration Script ===\n');

  // Step 1: Create default roles
  const roleMap = new Map<string, string>(); // enum name -> role id

  for (const roleDef of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: {},
      create: {
        name: roleDef.name,
        description: roleDef.description,
        isSystem: true,
        isActive: true,
        permissions: roleDef.permissions,
      },
    });
    roleMap.set(roleDef.name, role.id);
    console.log(`  Role: ${roleDef.name} -> ${role.id}`);
  }

  // Step 2: Map existing users to roleId
  console.log('\nMigrating users...');
  const users = await prisma.user.findMany({
    select: { id: true, role: true, roleId: true },
  });

  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    if (user.roleId) {
      skipped++;
      continue; // Already migrated
    }

    const roleId = roleMap.get(user.role);
    if (!roleId) {
      console.warn(`  WARNING: No role mapping for user ${user.id} with role "${user.role}"`);
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { roleId },
    });
    migrated++;
  }

  console.log(`  Migrated: ${migrated}, Skipped (already done): ${skipped}`);
  console.log('\n=== Migration complete ===');
  console.log('\nNext steps:');
  console.log('1. Verify all users have roleId set');
  console.log('2. Update schema: make roleId required, remove UserRole enum');
  console.log('3. Run: npx prisma db push && npx prisma generate');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
