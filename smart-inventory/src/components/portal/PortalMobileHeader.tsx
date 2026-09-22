"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { ShoppingCart, ChevronLeft } from "lucide-react";
import { useCart } from "@/components/portal/CartContext";
import { portalFetcher } from "@/lib/portal-fetcher";
import { useCompanyBranding } from "@/hooks/use-company-branding";

const PAGE_TITLES: Record<string, string> = {
  "/portal": "Customer Portal",
  "/portal/shop": "Browse",
  "/portal/cart": "Your Cart",
  "/portal/orders": "My Orders",
  "/portal/order-confirmed": "Order Placed!",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/portal/shop/")) return "Products";
  return "Customer Portal";
}

function isDeepShopPage(pathname: string): boolean {
  // e.g. /portal/shop/brandId or /portal/shop/brandId/subBrandId
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "portal" && parts[1] === "shop" && parts.length > 2;
}

export function PortalMobileHeader() {
  const pathname = usePathname();
  const isLoginPage = pathname === "/portal/login";
  const { totalItems } = useCart();
  const { branding } = useCompanyBranding();

  const { data } = useSWR<{ customer: { name: string } }>(
    isLoginPage ? null : "/api/portal/me",
    portalFetcher,
    { shouldRetryOnError: false }
  );

  if (isLoginPage) return null;

  const isSubPage = isDeepShopPage(pathname);
  const firstName = data?.customer?.name?.split(" ")[0];

  return (
    <header className="md:hidden sticky top-0 z-30 bg-gradient-to-r from-[#2D2A5E] to-[#1A1740] h-14 flex items-center px-4 shadow-md">
      <div className="flex items-center justify-between w-full gap-3">

        {/* Left — back button on sub-pages, logo on root pages */}
        {isSubPage ? (
          <Link
            href="/portal/shop"
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.12] text-white active:bg-white/20 transition-colors flex-shrink-0"
            aria-label="Back to shop"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
        ) : (
          <div className="rounded-lg bg-white px-2.5 py-1.5 shadow-sm flex-shrink-0">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt={`${branding.companyName} logo`} className="h-5 w-auto object-contain" />
            ) : (
              <span className="max-w-28 truncate text-xs font-semibold text-indigo-950">{branding.companyName}</span>
            )}
          </div>
        )}

        {/* Centre — greeting or page title */}
        <p className="text-white font-semibold text-sm tracking-tight truncate flex-1 text-center">
          {firstName && !isSubPage
            ? `Hi, ${firstName} 👋`
            : getPageTitle(pathname)}
        </p>

        {/* Right — cart icon */}
        <Link
          href="/portal/cart"
          className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.12] hover:bg-white/20 active:bg-white/25 transition-colors flex-shrink-0"
          aria-label={`Cart — ${totalItems} item${totalItems !== 1 ? "s" : ""}`}
        >
          <ShoppingCart className="h-5 w-5 text-white" />
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-amber-400 text-[#1A1740] text-[9px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm leading-none">
              {totalItems > 99 ? "99+" : totalItems}
            </span>
          )}
        </Link>

      </div>
    </header>
  );
}
