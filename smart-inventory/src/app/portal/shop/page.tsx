"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ShoppingBag, Play, Search, ShoppingCart, PackageCheck,
  ChevronRight, RefreshCw,
} from "lucide-react";
import { motion } from "motion/react";
import useSWR from "swr";
import { WelcomeModal } from "@/components/portal/WelcomeModal";
import { portalFetcher } from "@/lib/portal-fetcher";

// ── Types ─────────────────────────────────────────────────────────────────

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

// ── Mobile: inline brand list ─────────────────────────────────────────────

function MobileBrandList() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const { data, error, isLoading, mutate } = useSWR<{ brands: BrandNav[] }>(
    "/api/portal/nav",
    portalFetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  const brands = data?.brands ?? [];
  const q = query.toLowerCase().trim();
  const filtered = q ? brands.filter((b) => b.name.toLowerCase().includes(q)) : brands;

  return (
    <div className="px-4 pt-4 pb-2">
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search brands…"
          className="w-full h-11 bg-white border border-gray-200 rounded-xl pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2D2A5E]/20 focus:border-[#2D2A5E]/40 transition-all shadow-sm"
        />
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-2.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-[68px] rounded-2xl bg-white border border-gray-100 animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <p className="text-sm text-gray-400">Could not load brands.</p>
          <button
            type="button"
            onClick={() => mutate()}
            className="flex items-center gap-1.5 text-xs font-medium text-[#2D2A5E] hover:text-[#1A1740] transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Empty search */}
      {!isLoading && !error && filtered.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-10">
          No brands match &ldquo;{query}&rdquo;
        </p>
      )}

      {/* Brand cards */}
      {!isLoading && !error && (
        <div className="space-y-2.5">
          {filtered.map((brand, i) => {
            const totalItems = brand.subBrands.reduce(
              (sum, s) => sum + s._count.items,
              0
            );
            const initials = brand.name
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();

            return (
              <motion.button
                key={brand.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                onClick={() =>
                  router.push(
                    `/portal/shop/${brand.id}?brand=${encodeURIComponent(brand.name)}`
                  )
                }
                className="w-full flex items-center gap-3.5 bg-white border border-gray-100 rounded-2xl px-4 py-3.5 hover:border-[#2D2A5E]/25 hover:shadow-sm active:bg-gray-50 transition-all text-left"
              >
                {/* Avatar */}
                {brand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brand.logoUrl}
                    alt={brand.name}
                    className="w-11 h-11 rounded-xl object-contain bg-gray-50 flex-shrink-0 border border-gray-100"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-[#2D2A5E]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-[#2D2A5E]">
                      {initials}
                    </span>
                  </div>
                )}

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {brand.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {brand.subBrands.length}{" "}
                    {brand.subBrands.length === 1 ? "range" : "ranges"} ·{" "}
                    {totalItems} {totalItems === 1 ? "item" : "items"}
                  </p>
                </div>

                <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Desktop: how-to-start screen (unchanged) ──────────────────────────────

const steps = [
  {
    icon: Search,
    title: "Browse Brands",
    description: "Pick a brand from the sidebar to explore their product ranges.",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-100",
  },
  {
    icon: ShoppingCart,
    title: "Add to Cart",
    description: "Select items and quantities, then add them to your cart.",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100",
  },
  {
    icon: PackageCheck,
    title: "Place Order",
    description: "Review your cart and submit — we handle the rest.",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
  },
];

function DesktopWelcome({ customerName, onShowTutorial }: { customerName?: string; onShowTutorial: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-5">
          <ShoppingBag className="h-7 w-7 text-amber-500" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
          {customerName ? `Welcome back, ${customerName}` : "Welcome to Our Portal"}
        </h1>
        <p className="text-base text-gray-500 max-w-lg mx-auto leading-relaxed">
          Browse our catalog, add products to your cart, and place orders — all in one place.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl mb-10">
        {steps.map((step, i) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
            className="bg-white rounded-xl border border-gray-100 p-5 text-center shadow-sm"
          >
            <div className={`w-10 h-10 rounded-xl ${step.bg} ${step.border} border flex items-center justify-center mx-auto mb-3`}>
              <step.icon className={`h-5 w-5 ${step.color}`} />
            </div>
            <h3 className="text-sm font-semibold text-gray-800 mb-1">{step.title}</h3>
            <p className="text-xs leading-relaxed text-gray-400">{step.description}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.55 }}
        className="flex flex-col sm:flex-row items-center gap-3"
      >
        <p className="text-sm text-gray-400">
          ← Select a brand from the sidebar to get started
        </p>
        <span className="hidden sm:block text-gray-200">|</span>
        <button
          type="button"
          onClick={onShowTutorial}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#272462] hover:text-[#1E1B4B] transition-colors"
        >
          <Play className="h-3.5 w-3.5" />
          Watch Tutorial
        </button>
      </motion.div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

function ShopContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState(false);
  const [customerName, setCustomerName] = useState<string>();

  useEffect(() => {
    try {
      const stored = document.cookie
        .split("; ")
        .find((c) => c.startsWith("portal-token="));
      if (stored) {
        const payload = JSON.parse(atob(stored.split(".")[1]));
        setCustomerName(payload.name);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (searchParams.get("welcome") === "1") {
      setShowWelcome(true);
      router.replace("/portal/shop", { scroll: false });
    }
  }, [searchParams, router]);

  return (
    <>
      {showWelcome && (
        <WelcomeModal
          customerName={customerName}
          onClose={() => setShowWelcome(false)}
        />
      )}

      {/* Mobile: inline brand list */}
      <div className="md:hidden">
        <MobileBrandList />
      </div>

      {/* Desktop: sidebar-guided welcome screen */}
      <div className="hidden md:block">
        <DesktopWelcome
          customerName={customerName}
          onShowTutorial={() => setShowWelcome(true)}
        />
      </div>
    </>
  );
}

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <div className="md:hidden px-4 pt-4 space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[68px] rounded-2xl bg-white border border-gray-100 animate-pulse" />
          ))}
        </div>
      }
    >
      <ShopContent />
    </Suspense>
  );
}
