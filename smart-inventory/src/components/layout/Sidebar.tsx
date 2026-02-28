"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
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
} from "lucide-react";
import { useState, memo, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";

// Role-based access control
const ROLE_PERMISSIONS = {
  SALESMAN: {
    sales: true,
    ledger: false,
    reports: false,
    masters: false,
    employees: false,
    settings: false,
  },
  BILLING_OPERATOR: {
    sales: true,
    ledger: true,
    reports: true,
    masters: false,
    employees: false,
    settings: false,
  },
  ACCOUNTANT: {
    sales: true,
    ledger: true,
    reports: true,
    masters: true,
    employees: false,
    settings: false,
  },
  MANAGER: {
    sales: true,
    ledger: true,
    reports: true,
    masters: true,
    employees: true,
    settings: true,
  },
  ADMIN: {
    sales: true,
    ledger: true,
    reports: true,
    masters: true,
    employees: true,
    settings: true,
  },
};

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

export const Sidebar = memo(function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [salesOpen, setSalesOpen] = useState(false);
  const [purchasesOpen, setPurchasesOpen] = useState(false);
  const [bankCashOpen, setBankCashOpen] = useState(false);
  const [mastersOpen, setMastersOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);

  // Get user permissions
  const userRole = session?.user?.role || "SALESMAN";
  const permissions = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS] || ROLE_PERMISSIONS.SALESMAN;

  const salesItems = useMemo(() => [
    { icon: FileText, label: "Orders", href: "/sales/orders" },
    { icon: Receipt, label: "Invoices", href: "/sales/invoices" },
    { icon: Receipt, label: "Dummy Invoices", href: "/sales/dummy-invoices" },
    { icon: CreditCard, label: "Receipts", href: "/sales/receipts" },
    { icon: RotateCcw, label: "Returns", href: "/sales/returns" },
  ], []);

  const purchaseItems = useMemo(() => [
    { icon: FileText, label: "Orders", href: "/purchases/orders" },
    { icon: ClipboardList, label: "Reorders", href: "/purchases/reorders" },
    { icon: Receipt, label: "Invoices", href: "/purchases/invoices" },
    { icon: CreditCard, label: "Payments", href: "/purchases/payments" },
    { icon: RotateCcw, label: "Returns", href: "/purchases/returns" },
  ], []);

  const bankCashItems = useMemo(() => [
    { icon: Building2, label: "Accounts", href: "/bank-cash/accounts" },
    { icon: BookOpen, label: "Bank Ledger", href: "/bank-cash/ledger" },
  ], []);

  const masterItems = useMemo(() => [
    { icon: Users, label: "Customers", href: "/masters/customers" },
    { icon: Building2, label: "Vendors", href: "/masters/vendors" },
    ...(permissions.employees ? [{ icon: UserCircle, label: "Employees", href: "/masters/employees" }] : []),
    { icon: DollarSign, label: "Rate Sheets", href: "/masters/rate-sheets" },
  ], [permissions.employees]);

  const ledgerItems = useMemo(() => [
    { icon: Users, label: "Customer Ledger", href: "/ledger/customers" },
    { icon: Package, label: "Stock Ledger", href: "/ledger/items" },
    { icon: ClipboardList, label: "Stock Journal", href: "/ledger/stock-journal" },
  ], []);

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

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[230px] bg-gradient-to-b from-[#2D2A5E] via-[#272462] to-[#1A1740] flex flex-col shadow-xl">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.12]">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-900/20">
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M9 1v6m6-6v6" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-white font-semibold text-sm tracking-wide leading-tight">SRI BALAJI</span>
          <span className="text-amber-400/70 text-[10px] font-medium tracking-wider uppercase">Enterprises</span>
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
        {permissions.sales && (
          <>
            <div className="mx-3 my-3 h-px bg-white/[0.12]" />
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/50">
              Transactions
            </p>

            {/* Sales */}
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
                {salesItems.map((item) => {
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

            {/* Purchases */}
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
                {purchaseItems.map((item) => {
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

        {/* FINANCE section */}
        {permissions.ledger && (
          <>
            <div className="mx-3 my-3 h-px bg-white/[0.12]" />
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/50">
              Finance
            </p>

            {/* Bank/Cash */}
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
                {bankCashItems.map((item) => {
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

            {/* Ledger */}
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
                {ledgerItems.map((item) => {
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

        {/* ANALYTICS section */}
        {permissions.reports && (
          <>
            <div className="mx-3 my-3 h-px bg-white/[0.12]" />
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/50">
              Analytics
            </p>

            <div className="mb-0.5">
              <Link href="/reports" className={navLinkClass(pathname.startsWith("/reports"))}>
                <BarChart3 className="h-5 w-5" strokeWidth={1.5} />
                <span>Reports</span>
              </Link>
            </div>
          </>
        )}

        {/* CONFIGURATION section */}
        {permissions.masters && (
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
                {masterItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href} className={subLinkClass(isActive)}>
                      <Icon className="h-4 w-4" strokeWidth={1.5} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}

                {/* Items - direct link */}
                <Link
                  href="/masters/items"
                  className={subLinkClass(pathname.startsWith("/masters/items"))}
                >
                  <Package className="h-4 w-4" strokeWidth={1.5} />
                  <span>Items</span>
                </Link>
              </CollapsibleSection>
            </div>
          </>
        )}

        {/* Settings */}
        {permissions.settings && (
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
