"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import type { PermissionKey, RolePermissions } from "@/types/permissions";
import {
  LayoutDashboard,
  Database,
  ChevronDown,
  Users,
  Building2,
  UserCircle,
  DollarSign,
  Package,
  ShoppingCart,
  FileText,
  Receipt,
  CreditCard,
  RotateCcw,
  BookOpen,
  ClipboardList,
  Truck,
  BarChart3,
  Landmark,
  Settings,
  Shield,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  FileSpreadsheet,
  Calculator,
  GitCompareArrows,
  CalendarDays,
} from "lucide-react";
import { useState, memo, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";

function CollapsibleSection({
  isOpen,
  children,
}: {
  isOpen: boolean;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="overflow-hidden"
        >
          <div className="ml-8 mt-1 space-y-0.5 pb-1">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Check if at least one page key in the array has view permission */
function canViewAny(permissions: RolePermissions | undefined, keys: PermissionKey[]): boolean {
  if (!permissions) return false;
  return keys.some((k) => permissions[k]?.view);
}

/** Check if a specific page key has view permission */
function canView(permissions: RolePermissions | undefined, key: PermissionKey): boolean {
  return permissions?.[key]?.view === true;
}

type NavItem = {
  icon: typeof FileText;
  label: string;
  href: string;
  permKey: PermissionKey;
};

export const Sidebar = memo(function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [salesOpen, setSalesOpen] = useState(false);
  const [purchasesOpen, setPurchasesOpen] = useState(false);
  const [bankCashOpen, setBankCashOpen] = useState(false);
  const [mastersOpen, setMastersOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

  const permissions = session?.user?.permissions as RolePermissions | undefined;

  // Section visibility based on whether any child page has view permission
  const showSales = canViewAny(permissions, [
    'sales_orders', 'sales_invoices', 'sales_dummy_invoices', 'sales_receipts', 'sales_returns',
  ]);
  const showPurchases = canViewAny(permissions, [
    'purchases_orders', 'purchases_reorders', 'purchases_invoices', 'purchases_payments', 'purchases_returns',
  ]);
  const showTransactions = showSales || showPurchases;
  const showBankCash = canViewAny(permissions, ['bank_accounts', 'bank_ledger']);
  const showLedger = canViewAny(permissions, ['ledger_customers', 'ledger_stock', 'ledger_stock_journal']);
  const showFinance = showBankCash || showLedger;
  const showReports = canView(permissions, 'reports');
  const showMasters = canViewAny(permissions, [
    'masters_customers', 'masters_vendors', 'masters_employees', 'masters_rate_sheets', 'masters_items', 'masters_roles',
  ]);
  const showSettings = canView(permissions, 'settings');

  // Define nav items with permission keys for filtering
  const salesItems: NavItem[] = useMemo(() => [
    { icon: FileText, label: "Orders", href: "/sales/orders", permKey: "sales_orders" },
    { icon: Receipt, label: "Invoices", href: "/sales/invoices", permKey: "sales_invoices" },
    { icon: Receipt, label: "Dummy Invoices", href: "/sales/dummy-invoices", permKey: "sales_dummy_invoices" },
    { icon: CreditCard, label: "Receipts", href: "/sales/receipts", permKey: "sales_receipts" },
    { icon: RotateCcw, label: "Returns", href: "/sales/returns", permKey: "sales_returns" },
  ], []);

  const purchaseItems: NavItem[] = useMemo(() => [
    { icon: FileText, label: "Orders", href: "/purchases/orders", permKey: "purchases_orders" },
    { icon: ClipboardList, label: "Reorders", href: "/purchases/reorders", permKey: "purchases_reorders" },
    { icon: Receipt, label: "Invoices", href: "/purchases/invoices", permKey: "purchases_invoices" },
    { icon: CreditCard, label: "Payments", href: "/purchases/payments", permKey: "purchases_payments" },
    { icon: RotateCcw, label: "Returns", href: "/purchases/returns", permKey: "purchases_returns" },
  ], []);

  const bankCashItems: NavItem[] = useMemo(() => [
    { icon: Building2, label: "Accounts", href: "/bank-cash/accounts", permKey: "bank_accounts" },
    { icon: BookOpen, label: "Bank Ledger", href: "/bank-cash/ledger", permKey: "bank_ledger" },
  ], []);

  const ledgerItems: NavItem[] = useMemo(() => [
    { icon: Users, label: "Customer Ledger", href: "/ledger/customers", permKey: "ledger_customers" },
    { icon: Package, label: "Stock Ledger", href: "/ledger/items", permKey: "ledger_stock" },
    { icon: ClipboardList, label: "Stock Journal", href: "/ledger/stock-journal", permKey: "ledger_stock_journal" },
  ], []);

  const reportItems: NavItem[] = useMemo(() => [
    { icon: TrendingUp, label: "Sales Register", href: "/reports/sales-register", permKey: "reports" },
    { icon: TrendingDown, label: "Purchase Register", href: "/reports/purchase-register", permKey: "reports" },
    { icon: AlertCircle, label: "Outstanding", href: "/reports/outstanding", permKey: "reports" },
    { icon: Package, label: "Claim Report", href: "/reports/claim-report", permKey: "reports" },
    { icon: FileText, label: "Billed & Unbilled", href: "/reports/billed-unbilled", permKey: "reports" },
    { icon: Database, label: "Closing Stock", href: "/reports/closing-stock", permKey: "reports" },
    { icon: FileSpreadsheet, label: "GSTR-1", href: "/reports/gstr-1", permKey: "reports" },
    { icon: Calculator, label: "GSTR-3B", href: "/reports/gstr-3b", permKey: "reports" },
    { icon: GitCompareArrows, label: "GSTR-2", href: "/reports/gstr-2", permKey: "reports" },
    { icon: CalendarDays, label: "GSTR-9", href: "/reports/gstr-9", permKey: "reports" },
    { icon: ClipboardList, label: "Reorders", href: "/reports/reorders", permKey: "reports" },
  ], []);

  const masterItems: NavItem[] = useMemo(() => [
    { icon: Users, label: "Customers", href: "/masters/customers", permKey: "masters_customers" },
    { icon: Building2, label: "Vendors", href: "/masters/vendors", permKey: "masters_vendors" },
    { icon: UserCircle, label: "Employees", href: "/masters/employees", permKey: "masters_employees" },
    { icon: DollarSign, label: "Rate Sheets", href: "/masters/rate-sheets", permKey: "masters_rate_sheets" },
    { icon: Package, label: "Items", href: "/masters/items", permKey: "masters_items" },
    { icon: Shield, label: "Roles", href: "/masters/roles", permKey: "masters_roles" },
  ], []);

  /** Filter nav items to only those the user can view */
  const filterItems = (items: NavItem[]) =>
    items.filter((item) => canView(permissions, item.permKey));

  const navLinkClass = (isActive: boolean) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150",
      isActive
        ? "bg-white/[0.14] text-white font-medium border-l-2 border-amber-400 ml-[-2px]"
        : "text-white/80 hover:bg-white/[0.10] hover:text-white"
    );

  const subLinkClass = (isActive: boolean) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150",
      isActive
        ? "bg-white/[0.14] text-white font-medium"
        : "text-white/70 hover:bg-white/[0.10] hover:text-white"
    );

  const sectionButtonClass = (isActive: boolean) =>
    cn(
      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-all duration-150",
      isActive
        ? "bg-white/[0.14] text-white"
        : "text-white/80 hover:bg-white/[0.10] hover:text-white"
    );

  const renderNavItems = (items: NavItem[]) =>
    filterItems(items).map((item) => {
      const Icon = item.icon;
      const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
      return (
        <Link key={item.href} href={item.href} className={subLinkClass(isActive)}>
          <Icon className="h-4 w-4" strokeWidth={1.5} />
          <span>{item.label}</span>
        </Link>
      );
    });

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[230px] bg-gradient-to-b from-[#2D2A5E] via-[#272462] to-[#1A1740] flex flex-col shadow-xl">
      {/* Logo */}
      <div className="flex items-center justify-center px-3 py-4 border-b border-white/[0.12]">
        <div className="w-full rounded-lg bg-white p-2">
          <img src="/logo.jpg" alt="Sri Balaji Enterprises" className="w-full h-auto object-contain" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 sidebar-scrollbar">
        {/* Dashboard */}
        <Link href="/" className={navLinkClass(pathname === "/")}>
          <LayoutDashboard className="h-5 w-5" strokeWidth={1.5} />
          <span>Dashboard</span>
        </Link>

        {/* TRANSACTIONS section */}
        {showTransactions && (
          <>
            <div className="mx-3 my-3 h-px bg-white/[0.12]" />
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/50">
              Transactions
            </p>

            {/* Sales */}
            {showSales && (
              <div className="mb-0.5">
                <button
                  onClick={() => setSalesOpen(!salesOpen)}
                  className={sectionButtonClass(pathname.startsWith("/sales"))}
                >
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="h-5 w-5" strokeWidth={1.5} />
                    <span>Sales</span>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", salesOpen && "rotate-180")} />
                </button>
                <CollapsibleSection isOpen={salesOpen}>
                  {renderNavItems(salesItems)}
                </CollapsibleSection>
              </div>
            )}

            {/* Purchases */}
            {showPurchases && (
              <div className="mb-0.5">
                <button
                  onClick={() => setPurchasesOpen(!purchasesOpen)}
                  className={sectionButtonClass(pathname.startsWith("/purchases"))}
                >
                  <div className="flex items-center gap-3">
                    <Truck className="h-5 w-5" strokeWidth={1.5} />
                    <span>Purchases</span>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", purchasesOpen && "rotate-180")} />
                </button>
                <CollapsibleSection isOpen={purchasesOpen}>
                  {renderNavItems(purchaseItems)}
                </CollapsibleSection>
              </div>
            )}
          </>
        )}

        {/* FINANCE section */}
        {showFinance && (
          <>
            <div className="mx-3 my-3 h-px bg-white/[0.12]" />
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/50">
              Finance
            </p>

            {/* Bank/Cash */}
            {showBankCash && (
              <div className="mb-0.5">
                <button
                  onClick={() => setBankCashOpen(!bankCashOpen)}
                  className={sectionButtonClass(pathname.startsWith("/bank-cash"))}
                >
                  <div className="flex items-center gap-3">
                    <Landmark className="h-5 w-5" strokeWidth={1.5} />
                    <span>Bank/Cash</span>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", bankCashOpen && "rotate-180")} />
                </button>
                <CollapsibleSection isOpen={bankCashOpen}>
                  {renderNavItems(bankCashItems)}
                </CollapsibleSection>
              </div>
            )}

            {/* Ledger */}
            {showLedger && (
              <div className="mb-0.5">
                <button
                  onClick={() => setLedgerOpen(!ledgerOpen)}
                  className={sectionButtonClass(pathname.startsWith("/ledger"))}
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5" strokeWidth={1.5} />
                    <span>Ledger</span>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", ledgerOpen && "rotate-180")} />
                </button>
                <CollapsibleSection isOpen={ledgerOpen}>
                  {renderNavItems(ledgerItems)}
                </CollapsibleSection>
              </div>
            )}
          </>
        )}

        {/* ANALYTICS section */}
        {showReports && (
          <>
            <div className="mx-3 my-3 h-px bg-white/[0.12]" />
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/50">
              Analytics
            </p>
            <div className="mb-0.5">
              <button
                onClick={() => setReportsOpen(!reportsOpen)}
                className={sectionButtonClass(pathname.startsWith("/reports"))}
              >
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5" strokeWidth={1.5} />
                  <span>Reports</span>
                </div>
                <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", reportsOpen && "rotate-180")} />
              </button>
              <CollapsibleSection isOpen={reportsOpen}>
                {reportItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link key={item.href} href={item.href} className={subLinkClass(isActive)}>
                      <Icon className="h-4 w-4" strokeWidth={1.5} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </CollapsibleSection>
            </div>
          </>
        )}

        {/* CONFIGURATION section */}
        {showMasters && (
          <>
            <div className="mx-3 my-3 h-px bg-white/[0.12]" />
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/50">
              Configuration
            </p>

            {/* Masters */}
            <div className="mb-0.5">
              <button
                onClick={() => setMastersOpen(!mastersOpen)}
                className={sectionButtonClass(pathname.startsWith("/masters"))}
              >
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5" strokeWidth={1.5} />
                  <span>Masters</span>
                </div>
                <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", mastersOpen && "rotate-180")} />
              </button>
              <CollapsibleSection isOpen={mastersOpen}>
                {renderNavItems(masterItems)}
              </CollapsibleSection>
            </div>
          </>
        )}

        {/* Settings */}
        {showSettings && (
          <div className="mb-0.5">
            <Link href="/settings" className={navLinkClass(pathname === "/settings")}>
              <Settings className="h-5 w-5" strokeWidth={1.5} />
              <span>Settings</span>
            </Link>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/[0.12]">
        <p className="text-[10px] text-white/40 text-center">v0.2 by ksolutions</p>
      </div>
    </aside>
  );
});
