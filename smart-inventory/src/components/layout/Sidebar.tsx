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
  Tag,
  Layers,
  ShoppingCart,
  FileText,
  Receipt,
  CreditCard,
  RotateCcw,
  BookOpen,
  ClipboardList,
  Truck,
  BarChart3,
} from "lucide-react";
import { useState, memo, useMemo } from "react";

// Role-based access control
const ROLE_PERMISSIONS = {
  SALESMAN: {
    sales: true,
    ledger: false,
    reports: false,
    masters: false,
    employees: false,
  },
  BILLING_OPERATOR: {
    sales: true,
    ledger: true,
    reports: true,
    masters: false,
    employees: false,
  },
  ACCOUNTANT: {
    sales: true,
    ledger: true,
    reports: true,
    masters: true,
    employees: false,
  },
  MANAGER: {
    sales: true,
    ledger: true,
    reports: true,
    masters: true,
    employees: true,
  },
  ADMIN: {
    sales: true,
    ledger: true,
    reports: true,
    masters: true,
    employees: true,
  },
};

export const Sidebar = memo(function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [salesOpen, setSalesOpen] = useState(false);
  const [purchasesOpen, setPurchasesOpen] = useState(false);
  const [mastersOpen, setMastersOpen] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

  // Get user permissions
  const userRole = session?.user?.role || "SALESMAN";
  const permissions = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS] || ROLE_PERMISSIONS.SALESMAN;

  const salesItems = useMemo(() => [
    { icon: FileText, label: "Orders", href: "/sales/orders" },
    { icon: Receipt, label: "Invoices", href: "/sales/invoices" },
    { icon: CreditCard, label: "Receipts", href: "/sales/receipts" },
    { icon: RotateCcw, label: "Returns", href: "/sales/returns" },
  ], []);

  const purchaseItems = useMemo(() => [
    { icon: FileText, label: "Orders", href: "/purchases/orders" },
    { icon: Receipt, label: "Invoices", href: "/purchases/invoices" },
    { icon: CreditCard, label: "Payments", href: "/purchases/payments" },
    { icon: RotateCcw, label: "Returns", href: "/purchases/returns" },
  ], []);

  const masterItems = useMemo(() => [
    { icon: Users, label: "Customers", href: "/masters/customers" },
    { icon: Building2, label: "Vendors", href: "/masters/vendors" },
    ...(permissions.employees ? [{ icon: UserCircle, label: "Employees", href: "/masters/employees" }] : []),
    { icon: DollarSign, label: "Rate Sheets", href: "/masters/rate-sheets" },
  ], [permissions.employees]);

  const itemSubMenu = useMemo(() => [
    { icon: Tag, label: "Brands", href: "/masters/items/brands" },
    { icon: Layers, label: "Sub-brands", href: "/masters/items/sub-brands" },
    { icon: Package, label: "Items", href: "/masters/items" },
  ], []);

  const ledgerItems = useMemo(() => [
    { icon: Users, label: "Customer Ledger", href: "/ledger/customers" },
    { icon: Package, label: "Stock Ledger", href: "/ledger/items" },
    { icon: ClipboardList, label: "Stock Journal", href: "/ledger/stock-journal" },
  ], []);

  const reportItems = useMemo(() => [
    { icon: FileText, label: "Claim Report", href: "/reports/claim-report" },
  ], []);

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-primary border-r border-primary/20 flex flex-col shadow-lg">
      {/* Logo */}
      <div className="flex items-center gap-3 p-6 border-b border-white/10">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent shadow-md">
          <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M9 1v6m6-6v6" />
          </svg>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        {/* Dashboard */}
        <Link
          href="/"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors mb-2",
            pathname === "/" && "bg-white/15 text-white font-medium shadow-sm"
          )}
        >
          <LayoutDashboard className="h-5 w-5" strokeWidth={1.5} />
          <span>Dashboard</span>
        </Link>

        {/* Sales Section */}
        {permissions.sales && (
          <div className="mb-2">
            <button
              onClick={() => setSalesOpen(!salesOpen)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors",
                pathname.startsWith("/sales") && "bg-white/15 text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5" strokeWidth={1.5} />
                <span>Sales</span>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  salesOpen && "rotate-180"
                )}
              />
            </button>

            {/* Sales Dropdown */}
            {salesOpen && (
              <div className="ml-8 mt-1 space-y-1">
                {salesItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors",
                        isActive && "bg-white/15 text-white font-medium shadow-sm"
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.5} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Purchase Section */}
        <div className="mb-2">
          <button
            onClick={() => setPurchasesOpen(!purchasesOpen)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors",
              pathname.startsWith("/purchases") && "bg-white/15 text-white"
            )}
          >
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5" strokeWidth={1.5} />
              <span>Purchases</span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                purchasesOpen && "rotate-180"
              )}
            />
          </button>

          {/* Purchase Dropdown */}
          {purchasesOpen && (
            <div className="ml-8 mt-1 space-y-1">
              {purchaseItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors",
                      isActive && "bg-white/15 text-white font-medium shadow-sm"
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Ledger Section */}
        {permissions.ledger && (
          <div className="mb-2">
            <button
              onClick={() => setLedgerOpen(!ledgerOpen)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors",
                pathname.startsWith("/ledger") && "bg-white/15 text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5" strokeWidth={1.5} />
                <span>Ledger</span>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  ledgerOpen && "rotate-180"
                )}
              />
            </button>

            {/* Ledger Dropdown */}
            {ledgerOpen && (
              <div className="ml-8 mt-1 space-y-1">
                {ledgerItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors",
                        isActive && "bg-white/15 text-white font-medium shadow-sm"
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.5} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Reports Section */}
        {permissions.reports && (
          <div className="mb-2">
            <button
              onClick={() => setReportsOpen(!reportsOpen)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors",
                pathname.startsWith("/reports") && "bg-white/15 text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5" strokeWidth={1.5} />
                <span>Reports</span>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  reportsOpen && "rotate-180"
                )}
              />
            </button>

            {/* Reports Dropdown */}
            {reportsOpen && (
              <div className="ml-8 mt-1 space-y-1">
                {reportItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors",
                        isActive && "bg-white/15 text-white font-medium shadow-sm"
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.5} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Masters Section */}
        {permissions.masters && (
          <div className="mb-2">
            <button
              onClick={() => setMastersOpen(!mastersOpen)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors",
                pathname.startsWith("/masters") && "bg-white/15 text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5" strokeWidth={1.5} />
                <span>Masters</span>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  mastersOpen && "rotate-180"
                )}
              />
            </button>

            {/* Masters Dropdown */}
            {mastersOpen && (
              <div className="ml-8 mt-1 space-y-1">
                {masterItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors",
                        isActive && "bg-white/15 text-white font-medium shadow-sm"
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.5} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}

                {/* Items with Sub-dropdown */}
                <div>
                  <button
                    onClick={() => setItemsOpen(!itemsOpen)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors",
                      pathname.startsWith("/masters/items") && "bg-white/15 text-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Package className="h-4 w-4" strokeWidth={1.5} />
                      <span>Items</span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 transition-transform",
                        itemsOpen && "rotate-180"
                      )}
                    />
                  </button>

                  {/* Items Sub-dropdown */}
                  {itemsOpen && (
                    <div className="ml-7 mt-1 space-y-1">
                      {itemSubMenu.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white transition-colors",
                              isActive && "bg-white/15 text-white font-medium shadow-sm"
                            )}
                          >
                            <Icon className="h-3 w-3" strokeWidth={1.5} />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </nav>

    </aside>
  );
});