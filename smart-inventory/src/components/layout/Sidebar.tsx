"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { useState } from "react";

export function Sidebar() {
  const pathname = usePathname();
  const [mastersOpen, setMastersOpen] = useState(true);
  const [itemsOpen, setItemsOpen] = useState(false);

  const masterItems = [
    { icon: Users, label: "Customers", href: "/masters/customers" },
    { icon: Building2, label: "Vendors", href: "/masters/vendors" },
    { icon: UserCircle, label: "Employees", href: "/masters/employees" },
    { icon: DollarSign, label: "Rate Sheets", href: "/masters/rate-sheets" },
  ];

  const itemSubMenu = [
    { icon: Tag, label: "Brands", href: "/masters/items/brands" },
    { icon: Layers, label: "Sub-brands", href: "/masters/items/sub-brands" },
    { icon: Package, label: "Items", href: "/masters/items" },
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 p-6 border-b border-gray-200">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600">
          <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h1 className="text-gray-900 font-bold text-lg"></h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        {/* Dashboard */}
        <Link
          href="/"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors mb-2",
            pathname === "/" && "bg-gray-100 text-gray-900 font-medium"
          )}
        >
          <LayoutDashboard className="h-5 w-5" strokeWidth={1.5} />
          <span>Dashboard</span>
        </Link>

        {/* Masters Section */}
        <div className="mb-2">
          <button
            onClick={() => setMastersOpen(!mastersOpen)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors",
              pathname.startsWith("/masters") && "bg-gray-100"
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
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors",
                      isActive && "bg-gray-100 text-gray-900 font-medium"
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
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors",
                    pathname.startsWith("/masters/items") && "bg-gray-100 text-gray-900"
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
                            "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors",
                            isActive && "bg-gray-100 text-gray-900 font-medium"
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
      </nav>

    </aside>
  );
}
