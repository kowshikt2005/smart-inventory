"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { ShoppingCart, LogOut, User } from "lucide-react";
import { useCart } from "@/components/portal/CartContext";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (r.status === 401) {
    window.location.href = "/portal/login";
    return null;
  }
  return r.json();
};

const PAGE_TITLES: Record<string, string> = {
  "/portal/shop": "Browse Catalog",
  "/portal/cart": "Your Cart",
  "/portal/orders": "My Orders",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.includes("/portal/shop/")) return "Products";
  return "Customer Portal";
}

export function PortalTopbar() {
  const pathname = usePathname();
  const isLoginPage = pathname === "/portal/login";

  const { data } = useSWR<{ customer: { name: string; customerNumber: string } }>(
    isLoginPage ? null : "/api/portal/me",
    fetcher,
    { shouldRetryOnError: false }
  );
  const { totalItems } = useCart();

  async function handleLogout() {
    await fetch("/api/portal/logout", { method: "POST" });
    window.location.href = "/portal/login";
  }

  const customer = data?.customer;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm h-14 flex items-center">
      <div className="w-full px-6 flex items-center justify-between">
        {/* Page title */}
        <p className="text-sm font-semibold text-gray-700">
          {getPageTitle(pathname)}
        </p>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {customer && (
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5">
              <User className="h-3.5 w-3.5 text-gray-400" />
              <span className="font-medium text-gray-700">{customer.name}</span>
              <span className="text-gray-300">·</span>
              <span className="text-gray-400 text-xs font-mono">{customer.customerNumber}</span>
            </div>
          )}

          {/* Cart */}
          <Link
            href="/portal/cart"
            prefetch={false}
            className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-amber-50 transition-colors group"
            aria-label={`Cart (${totalItems} items)`}
          >
            <ShoppingCart className="h-5 w-5 text-gray-500 group-hover:text-amber-600 transition-colors" />
            {totalItems > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                {totalItems > 99 ? "99+" : totalItems}
              </span>
            )}
          </Link>

          {/* Logout */}
          {customer && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Sign out</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
