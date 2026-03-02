/**
 * Centralized permission definitions for the custom RBAC system.
 * Each page/section has a unique key with view + edit toggles.
 */

export const PERMISSION_PAGES = {
  dashboard:            { label: 'Dashboard',          section: 'General' },
  sales_orders:         { label: 'Sales Orders',       section: 'Sales' },
  sales_invoices:       { label: 'Sales Invoices',     section: 'Sales' },
  sales_dummy_invoices: { label: 'Dummy Invoices',     section: 'Sales' },
  sales_receipts:       { label: 'Receipts',           section: 'Sales' },
  sales_returns:        { label: 'Sales Returns',      section: 'Sales' },
  purchases_orders:     { label: 'Purchase Orders',    section: 'Purchases' },
  purchases_reorders:   { label: 'Reorders',           section: 'Purchases' },
  purchases_invoices:   { label: 'Purchase Invoices',  section: 'Purchases' },
  purchases_payments:   { label: 'Payments',           section: 'Purchases' },
  purchases_returns:    { label: 'Purchase Returns',   section: 'Purchases' },
  bank_accounts:        { label: 'Bank Accounts',      section: 'Bank/Cash' },
  bank_ledger:          { label: 'Bank Ledger',        section: 'Bank/Cash' },
  ledger_customers:     { label: 'Customer Ledger',    section: 'Ledger' },
  ledger_vendors:       { label: 'Vendor Ledger',      section: 'Ledger' },
  ledger_stock:         { label: 'Stock Ledger',       section: 'Ledger' },
  ledger_stock_journal: { label: 'Stock Journal',      section: 'Ledger' },
  reports:              { label: 'Reports',            section: 'Analytics' },
  masters_customers:    { label: 'Customers',          section: 'Masters' },
  masters_vendors:      { label: 'Vendors',            section: 'Masters' },
  masters_employees:    { label: 'Employees',          section: 'Masters' },
  masters_rate_sheets:  { label: 'Rate Sheets',        section: 'Masters' },
  masters_items:        { label: 'Items',              section: 'Masters' },
  masters_roles:        { label: 'Roles',              section: 'Masters' },
  settings:             { label: 'Settings',           section: 'Settings' },
} as const;

export type PermissionKey = keyof typeof PERMISSION_PAGES;

export interface PagePermission {
  view: boolean;
  edit: boolean;
}

export type RolePermissions = Record<PermissionKey, PagePermission>;

/** All permission keys as an array (useful for iteration) */
export const ALL_PERMISSION_KEYS = Object.keys(PERMISSION_PAGES) as PermissionKey[];

/** Get unique sections for grouping in UI */
export function getPermissionSections(): { section: string; keys: PermissionKey[] }[] {
  const sectionMap = new Map<string, PermissionKey[]>();
  for (const [key, { section }] of Object.entries(PERMISSION_PAGES)) {
    if (!sectionMap.has(section)) sectionMap.set(section, []);
    sectionMap.get(section)!.push(key as PermissionKey);
  }
  return Array.from(sectionMap.entries()).map(([section, keys]) => ({ section, keys }));
}

/** Map URL paths to permission keys */
export const PATH_TO_PERMISSION: Record<string, PermissionKey> = {
  '/': 'dashboard',
  '/sales/orders': 'sales_orders',
  '/sales/invoices': 'sales_invoices',
  '/sales/dummy-invoices': 'sales_dummy_invoices',
  '/sales/receipts': 'sales_receipts',
  '/sales/returns': 'sales_returns',
  '/purchases/orders': 'purchases_orders',
  '/purchases/reorders': 'purchases_reorders',
  '/purchases/invoices': 'purchases_invoices',
  '/purchases/payments': 'purchases_payments',
  '/purchases/returns': 'purchases_returns',
  '/bank-cash/accounts': 'bank_accounts',
  '/bank-cash/ledger': 'bank_ledger',
  '/ledger/customers': 'ledger_customers',
  '/ledger/vendors': 'ledger_vendors',
  '/ledger/items': 'ledger_stock',
  '/ledger/stock-journal': 'ledger_stock_journal',
  '/reports': 'reports',
  '/masters/customers': 'masters_customers',
  '/masters/vendors': 'masters_vendors',
  '/masters/employees': 'masters_employees',
  '/masters/rate-sheets': 'masters_rate_sheets',
  '/masters/items': 'masters_items',
  '/masters/roles': 'masters_roles',
  '/settings': 'settings',
};

/** Map API route prefixes to permission keys */
export const API_TO_PERMISSION: Record<string, PermissionKey> = {
  '/api/sales-orders': 'sales_orders',
  '/api/sales-invoices': 'sales_invoices',
  '/api/dummy-invoices': 'sales_dummy_invoices',
  '/api/payments': 'sales_receipts',
  '/api/sales-returns': 'sales_returns',
  '/api/purchase-orders': 'purchases_orders',
  '/api/reorders': 'purchases_reorders',
  '/api/stock-scan': 'purchases_reorders',
  '/api/purchase-invoices': 'purchases_invoices',
  '/api/vendor-payments': 'purchases_payments',
  '/api/purchase-returns': 'purchases_returns',
  '/api/bank-accounts': 'bank_accounts',
  '/api/bank-ledger': 'bank_ledger',
  '/api/customers': 'masters_customers',
  '/api/vendors': 'masters_vendors',
  '/api/employees': 'masters_employees',
  '/api/rate-sheets': 'masters_rate_sheets',
  '/api/items': 'masters_items',
  '/api/brands': 'masters_items',
  '/api/sub-brands': 'masters_items',
  '/api/stock-journals': 'ledger_stock_journal',
  '/api/ledger/customers': 'ledger_customers',
  '/api/ledger/vendors': 'ledger_vendors',
  '/api/ledger/items': 'ledger_stock',
  '/api/ledger/bank-accounts': 'bank_ledger',
  '/api/reports': 'reports',
  '/api/dashboard': 'dashboard',
  '/api/roles': 'masters_roles',
  '/api/settings': 'settings',
  '/api/system': 'settings',
};
