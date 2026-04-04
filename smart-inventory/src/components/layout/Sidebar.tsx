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
import { useState, memo, useMemo, useEffect } from "react";
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

type SidebarSection = "sales" | "purchases" | "bank-cash" | "ledger" | "gst" | "masters" | null;

function getSectionFromPath(pathname: string): SidebarSection {
  if (pathname.startsWith("/sales")) return "sales";
  if (pathname.startsWith("/purchases")) return "purchases";
  if (pathname.startsWith("/bank-cash")) return "bank-cash";
  if (pathname.startsWith("/ledger")) return "ledger";
  if (pathname.startsWith("/gst")) return "gst";
  if (pathname.startsWith("/masters")) return "masters";
  return null;
}

export const Sidebar = memo(function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [openSection, setOpenSection] = useState<SidebarSection>(getSectionFromPath(pathname));

  // Auto-expand sidebar section when navigating to a new page
  useEffect(() => {
    const section = getSectionFromPath(pathname);
    if (section) setOpenSection(section);
  }, [pathname]);

  const toggleSection = (section: SidebarSection) => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

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
          <img src="/logo-sbe.jpg" alt="Sri Balaji Enterprises" width={200} height={48} className="w-full h-auto object-contain" />
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
                  onClick={() => toggleSection("sales")}
                  className={sectionButtonClass(pathname.startsWith("/sales"))}
                >
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="h-5 w-5" strokeWidth={1.5} />
                    <span>Sales</span>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", openSection === "sales" && "rotate-180")} />
                </button>
                <CollapsibleSection isOpen={openSection === "sales"}>
                  {renderNavItems(salesItems)}
                </CollapsibleSection>
              </div>
            )}

            {/* Purchases */}
            {showPurchases && (
              <div className="mb-0.5">
                <button
                  onClick={() => toggleSection("purchases")}
                  className={sectionButtonClass(pathname.startsWith("/purchases"))}
                >
                  <div className="flex items-center gap-3">
                    <Truck className="h-5 w-5" strokeWidth={1.5} />
                    <span>Purchases</span>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", openSection === "purchases" && "rotate-180")} />
                </button>
                <CollapsibleSection isOpen={openSection === "purchases"}>
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
                  onClick={() => toggleSection("bank-cash")}
                  className={sectionButtonClass(pathname.startsWith("/bank-cash"))}
                >
                  <div className="flex items-center gap-3">
                    <Landmark className="h-5 w-5" strokeWidth={1.5} />
                    <span>Bank/Cash</span>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", openSection === "bank-cash" && "rotate-180")} />
                </button>
                <CollapsibleSection isOpen={openSection === "bank-cash"}>
                  {renderNavItems(bankCashItems)}
                </CollapsibleSection>
              </div>
            )}

            {/* Ledger */}
            {showLedger && (
              <div className="mb-0.5">
                <button
                  onClick={() => toggleSection("ledger")}
                  className={sectionButtonClass(pathname.startsWith("/ledger"))}
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5" strokeWidth={1.5} />
                    <span>Ledger</span>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", openSection === "ledger" && "rotate-180")} />
                </button>
                <CollapsibleSection isOpen={openSection === "ledger"}>
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
                  onClick={() => toggleSection("gst")}
                  className={sectionButtonClass(pathname.startsWith("/gst"))}
                >
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-5 w-5" strokeWidth={1.5} />
                    <span>GST</span>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", openSection === "gst" && "rotate-180")} />
                </button>
                <CollapsibleSection isOpen={openSection === "gst"}>
                  {renderNavItems(gstItems)}
                </CollapsibleSection>
              </div>
            )}
          </>
        )}

        {/* CONFIGURATION section */}
        {showMasters && (
          <div className="mb-0.5">
            <button
              onClick={() => toggleSection("masters")}
              className={sectionButtonClass(pathname.startsWith("/masters"))}
            >
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5" strokeWidth={1.5} />
                <span>Masters</span>
              </div>
              <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", openSection === "masters" && "rotate-180")} />
            </button>
            <CollapsibleSection isOpen={openSection === "masters"}>
              {renderNavItems(masterItems)}
            </CollapsibleSection>
          </div>
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
      <div className="border-t border-white/[0.12] bg-black/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-ksolutions.jpg" alt="KSolutions - Your Gateway to Digital Excellence" width={230} height={40} className="w-full h-auto object-cover" />
      </div>
    </aside>
  );
});
