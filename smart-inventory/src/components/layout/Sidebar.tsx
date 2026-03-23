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
  FileSpreadsheet,
  Calculator,
  GitCompareArrows,
  CalendarDays,
  Settings,
  Shield,
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
  const [gstOpen, setGstOpen] = useState(false);


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
  const showGST = canView(permissions, 'gst');
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

  const gstItems: NavItem[] = useMemo(() => [
    { icon: FileSpreadsheet,  label: "GSTR-1",  href: "/gst/gstr-1",  permKey: "gst" },
    { icon: GitCompareArrows, label: "GSTR-2",  href: "/gst/gstr-2",  permKey: "gst" },
    { icon: Calculator,       label: "GSTR-3B", href: "/gst/gstr-3b", permKey: "gst" },
    { icon: CalendarDays,     label: "GSTR-9",  href: "/gst/gstr-9",  permKey: "gst" },
  ], []);

  const masterItems: NavItem[] = useMemo(() => [
    { icon: Users, label: "Customers", href: "/masters/customers", permKey: "masters_customers" },
    { icon: Building2, label: "Vendors", href: "/masters/vendors", permKey: "masters_vendors" },
    { icon: UserCircle, label: "Employees", href: "/masters/employees", permKey: "masters_employees" },
    { icon: Package, label: "Items", href: "/masters/items", permKey: "masters_items" },
    { icon: Shield, label: "Roles", href: "/masters/roles", permKey: "masters_roles" },
  ], []);

  /** Filter nav items to only those the user can view */
  const filterItems = (items: NavItem[]) =>
    items.filter((item) => canView(permissions, item.permKey));

  const navLinkClass = (isActive: boolean) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150",
      isActive
        ? "bg-white/[0.14] text-white font-medium border-l-2 border-amber-400 ml-[-2px]"
        : "text-white/80 hover:bg-white/[0.10] hover:text-white"
    );

  const subLinkClass = (isActive: boolean) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150",
      isActive
        ? "bg-white/[0.14] text-white font-medium"
        : "text-white/70 hover:bg-white/[0.10] hover:text-white"
    );

  const sectionButtonClass = (isActive: boolean) =>
    cn(
      "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-all duration-150",
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
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
        {(showReports || showGST) && (
          <>

            {showReports && (
              <div className="mb-0.5">
                <Link href="/reports" className={navLinkClass(pathname.startsWith("/reports"))}>
                  <BarChart3 className="h-5 w-5" strokeWidth={1.5} />
                  <span>Reports</span>
                </Link>
              </div>
            )}
            {showGST && (
              <div className="mb-0.5">
                <button
                  onClick={() => setGstOpen(!gstOpen)}
                  className={sectionButtonClass(pathname.startsWith("/gst"))}
                >
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-5 w-5" strokeWidth={1.5} />
                    <span>GST</span>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", gstOpen && "rotate-180")} />
                </button>
                <CollapsibleSection isOpen={gstOpen}>
                  {renderNavItems(gstItems)}
                </CollapsibleSection>
              </div>
            )}
          </>
        )}

        {/* CONFIGURATION section */}
        {showMasters && (
          <>


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

      {/* Footer - KSolutions branding */}
      <div className="border-t border-white/[0.12] px-3 py-4 bg-black/20 flex flex-col items-center gap-2">
        {/* Circuit-board K logo */}
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Outer ring */}
          <circle cx="26" cy="26" r="22" stroke="#29B6CF" strokeWidth="1.4" strokeDasharray="3 1.5" opacity="0.7"/>
          {/* Top arm */}
          <line x1="26" y1="4" x2="26" y2="14" stroke="#29B6CF" strokeWidth="1.6"/>
          <line x1="26" y1="9" x2="31" y2="9" stroke="#29B6CF" strokeWidth="1.2"/>
          <circle cx="31" cy="9" r="1.8" fill="#29B6CF"/>
          <circle cx="26" cy="4" r="1.8" fill="#29B6CF"/>
          {/* Bottom arm */}
          <line x1="26" y1="48" x2="26" y2="38" stroke="#4CAF75" strokeWidth="1.6"/>
          <line x1="26" y1="43" x2="21" y2="43" stroke="#4CAF75" strokeWidth="1.2"/>
          <circle cx="21" cy="43" r="1.8" fill="#4CAF75"/>
          <circle cx="26" cy="48" r="1.8" fill="#4CAF75"/>
          {/* Left arm */}
          <line x1="4" y1="26" x2="14" y2="26" stroke="#29B6CF" strokeWidth="1.6"/>
          <line x1="9" y1="26" x2="9" y2="21" stroke="#29B6CF" strokeWidth="1.2"/>
          <circle cx="9" cy="21" r="1.8" fill="#29B6CF"/>
          <circle cx="4" cy="26" r="1.8" fill="#29B6CF"/>
          {/* Right arm */}
          <line x1="48" y1="26" x2="38" y2="26" stroke="#4CAF75" strokeWidth="1.6"/>
          <line x1="43" y1="26" x2="43" y2="31" stroke="#4CAF75" strokeWidth="1.2"/>
          <circle cx="43" cy="31" r="1.8" fill="#4CAF75"/>
          <circle cx="48" cy="26" r="1.8" fill="#4CAF75"/>
          {/* Inner ring */}
          <circle cx="26" cy="26" r="11" fill="#1A1740" stroke="#29B6CF" strokeWidth="1.6"/>
          {/* K letter */}
          <text x="26" y="30.5" textAnchor="middle" fill="white" fontSize="11" fontWeight="800" fontFamily="Arial, sans-serif">K</text>
        </svg>

        {/* KSOLUTIONS text */}
        <p className="text-[13px] font-black tracking-[0.22em] text-white leading-none">
          KSOLUTIONS
        </p>

        {/* Tagline */}
        <p className="text-[8.5px] font-semibold tracking-[0.12em] text-amber-400 text-center leading-tight opacity-90">
          YOUR GATEWAY TO<br />DIGITAL EXCELLENCE
        </p>
      </div>
    </aside>
  );
});
