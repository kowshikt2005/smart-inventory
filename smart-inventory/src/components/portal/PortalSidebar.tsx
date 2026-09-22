"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShoppingCart, Package, ChevronDown, Layers, Search, ArrowUpDown } from "lucide-react";
import { useCart } from "@/components/portal/CartContext";
import { cn } from "@/lib/utils";
import { portalFetcher } from "@/lib/portal-fetcher";
import { useCompanyBranding } from "@/hooks/use-company-branding";

interface SubBrandNav {
  id: string;
  name: string;
  _count: { items: number };
}

interface BrandNav {
  id: string;
  name: string;
  logoUrl: string | null;
  subBrands: SubBrandNav[];
}

export function PortalSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { totalItems } = useCart();
  const { branding } = useCompanyBranding();
  const isLoginPage = pathname === "/portal/login";

  // Skip API call entirely on login page — user isn't authenticated yet
  const { data, error } = useSWR<{ brands: BrandNav[] }>(
    isLoginPage ? null : "/api/portal/nav",
    portalFetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      onError: () => {}, // suppress console noise
    }
  );

  const brands = data?.brands ?? [];
  const isLoading = !isLoginPage && !data && !error;

  // Auto-expand the brand whose sub-brand is currently active
  const activeBrandId = (() => {
    const match = pathname.match(/\/portal\/shop\/([^/]+)/);
    if (!match) return null;
    return brands.find((b) => b.id === match[1])?.id ?? null;
  })();

  const [openBrandId, setOpenBrandId] = useState<string | null>(activeBrandId);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    if (activeBrandId) setOpenBrandId(activeBrandId);
  }, [activeBrandId]);

  const activeSubBrandId = pathname.match(/\/portal\/shop\/[^/]+\/([^/]+)/)?.[1] ?? null;

  return (
    <aside className="hidden md:flex fixed left-0 top-0 z-40 h-screen w-[230px] bg-gradient-to-b from-[#2D2A5E] via-[#272462] to-[#1A1740] flex-col shadow-xl">
      {/* Logo */}
      <div className="flex items-center justify-center px-3 py-3 border-b border-white/[0.12]">
        <div className="w-full rounded-lg bg-white px-3 py-2 flex items-center justify-center min-h-[48px]">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={`${branding.companyName} logo`} className="w-full h-auto object-contain max-h-9" />
          ) : (
            <span className="text-center text-sm font-semibold text-indigo-950">{branding.companyName}</span>
          )}
        </div>
      </div>

      {/* Customer Portal label */}
      <div className="px-4 py-2 border-b border-white/[0.08]">
        <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400/80 font-semibold text-center">
          Customer Portal
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        <div className="flex items-center justify-between px-3 pt-1 pb-1">
          <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">
            Browse
          </p>
          {!isLoginPage && brands.length > 1 && (
            <button
              onClick={() => setSortAsc((v) => !v)}
              className="flex items-center gap-1 text-[10px] text-white/40 hover:text-amber-400 transition-colors"
              title={sortAsc ? "Sort Z → A" : "Sort A → Z"}
            >
              <ArrowUpDown className="h-3 w-3" />
              {sortAsc ? "A-Z" : "Z-A"}
            </button>
          )}
        </div>

        {/* Search */}
        {!isLoginPage && brands.length > 0 && (
          <div className="relative px-2 pb-2">
            <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search brands…"
              className="w-full bg-white/[0.08] text-white text-xs placeholder:text-white/30 rounded-lg pl-8 pr-3 py-2 border border-white/[0.06] focus:border-amber-400/40 focus:bg-white/[0.12] outline-none transition-all"
            />
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="px-3 py-3 space-y-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 rounded-lg bg-white/[0.06] animate-pulse" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="px-3 py-3 text-center">
            <p className="text-[11px] text-white/30">Could not load catalog.</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && brands.length === 0 && !isLoginPage && (
          <div className="px-3 py-3 text-center">
            <p className="text-[11px] text-white/30 italic">No brands available.</p>
          </div>
        )}

        {/* No search results */}
        {!isLoading && !error && brands.length > 0 && searchQuery.trim() && !brands.some((b) => b.name.toLowerCase().includes(searchQuery.toLowerCase().trim())) && (
          <div className="px-3 py-3 text-center">
            <p className="text-[11px] text-white/30 italic">No brands match &ldquo;{searchQuery.trim()}&rdquo;</p>
          </div>
        )}

        {/* Brand list */}
        {(() => {
          const q = searchQuery.toLowerCase().trim();
          let filtered = q ? brands.filter((b) => b.name.toLowerCase().includes(q)) : brands;
          if (!sortAsc) filtered = [...filtered].reverse();
          return filtered;
        })().map((brand) => {
          const isOpen = openBrandId === brand.id;
          const initials = brand.name
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();

          return (
            <div key={brand.id}>
              <button
                onClick={() => setOpenBrandId(isOpen ? null : brand.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-all duration-150",
                  isOpen
                    ? "bg-white/[0.14] text-white"
                    : "text-white/80 hover:bg-white/[0.10] hover:text-white"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {brand.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={brand.logoUrl}
                      alt={brand.name}
                      className="w-5 h-5 rounded object-contain bg-white/10 flex-shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-5 h-5 rounded bg-amber-500/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-amber-300">{initials}</span>
                    </div>
                  )}
                  <span className="truncate font-medium">{brand.name}</span>
                </div>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-white/50 flex-shrink-0 transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="ml-7 mt-0.5 space-y-0.5 pb-1">
                      {brand.subBrands.map((sub) => {
                        const isActive = activeSubBrandId === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() =>
                              router.push(
                                `/portal/shop/${brand.id}/${sub.id}?brand=${encodeURIComponent(brand.name)}`
                              )
                            }
                            className={cn(
                              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition-all duration-150",
                              isActive
                                ? "bg-white/[0.14] text-white font-semibold border-l-2 border-amber-400 -ml-0.5 pl-[14px]"
                                : "text-white/65 hover:bg-white/[0.08] hover:text-white"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Layers className="h-3 w-3 flex-shrink-0 opacity-60" />
                              <span className="truncate">{sub.name}</span>
                            </div>
                            <span className="text-[10px] text-white/30 flex-shrink-0 ml-1">
                              {sub._count.items}
                            </span>
                          </button>
                        );
                      })}
                      {brand.subBrands.length === 0 && (
                        <p className="px-3 py-1.5 text-[11px] text-white/25 italic">
                          No ranges available
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Cart + Orders — only rendered after authentication to prevent pre-auth prefetch caching */}
        {!isLoginPage && (
          <>
            {/* Divider */}
            <div className="border-t border-white/[0.08] my-2" />

            {/* Cart */}
            <Link
              href="/portal/cart"
              prefetch={false}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-all duration-150",
                pathname === "/portal/cart"
                  ? "bg-white/[0.14] text-white font-medium border-l-2 border-amber-400 -ml-0.5 pl-[14px]"
                  : "text-white/80 hover:bg-white/[0.10] hover:text-white"
              )}
            >
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="h-4 w-4" strokeWidth={1.5} />
                <span>Cart</span>
              </div>
              {totalItems > 0 && (
                <span className="min-w-[18px] h-[18px] bg-amber-400 text-[#1E1B4B] text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              )}
            </Link>

            {/* Orders */}
            <Link
              href="/portal/orders"
              prefetch={false}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all duration-150",
                pathname === "/portal/orders"
                  ? "bg-white/[0.14] text-white font-medium border-l-2 border-amber-400 -ml-0.5 pl-[14px]"
                  : "text-white/80 hover:bg-white/[0.10] hover:text-white"
              )}
            >
              <Package className="h-4 w-4" strokeWidth={1.5} />
              <span>My Orders</span>
            </Link>
          </>
        )}
      </nav>

      <div className="h-3" />
    </aside>
  );
}
