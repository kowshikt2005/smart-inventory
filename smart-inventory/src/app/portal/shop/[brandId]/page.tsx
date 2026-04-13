"use client";

import { Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { Layers, ChevronRight, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { portalFetcher } from "@/lib/portal-fetcher";

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

// ── Mobile: inline sub-brand list ────────────────────────────────────────

function MobileSubBrandList() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const brandId = params.brandId as string;
  const brandName = searchParams.get("brand") ?? "";

  const { data, error, isLoading, mutate } = useSWR<{ brands: BrandNav[] }>(
    "/api/portal/nav",
    portalFetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  const brand = data?.brands.find((b) => b.id === brandId);
  const subBrands = brand?.subBrands ?? [];

  return (
    <div className="px-4 pt-4 pb-2">
      {/* Brand heading */}
      {brandName && (
        <div className="mb-4">
          <h2 className="text-base font-bold text-[#1A1740] truncate">{brandName}</h2>
          <p className="text-xs text-gray-400 mt-0.5">Select a product range to browse items</p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
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
          <p className="text-sm text-gray-400">Could not load ranges.</p>
          <button
            type="button"
            onClick={() => mutate()}
            className="flex items-center gap-1.5 text-xs font-medium text-[#2D2A5E]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && subBrands.length === 0 && (
        <p className="text-center text-sm text-gray-400 italic py-10">
          No product ranges available.
        </p>
      )}

      {/* Sub-brand cards */}
      {!isLoading && !error && (
        <div className="space-y-2.5">
          {subBrands.map((sub, i) => (
            <motion.button
              key={sub.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: i * 0.05 }}
              onClick={() =>
                router.push(
                  `/portal/shop/${brandId}/${sub.id}?brand=${encodeURIComponent(brandName)}`
                )
              }
              className="w-full flex items-center gap-3.5 bg-white border border-gray-100 rounded-2xl px-4 py-3.5 hover:border-amber-200 hover:shadow-sm active:bg-amber-50/50 transition-all text-left"
            >
              {/* Icon */}
              <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Layers className="h-5 w-5 text-amber-500" strokeWidth={1.5} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {sub.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {sub._count.items} {sub._count.items === 1 ? "item" : "items"}
                </p>
              </div>

              <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Desktop: sidebar-guided placeholder (unchanged) ───────────────────────

function DesktopBrandPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-5">
        <Layers className="h-8 w-8 text-amber-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">Select a Range</h2>
      <p className="text-gray-400 text-sm max-w-xs">
        Choose a product range from the sidebar to see available items.
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

function BrandContent() {
  return (
    <>
      {/* Mobile: inline sub-brand list */}
      <div className="md:hidden">
        <MobileSubBrandList />
      </div>

      {/* Desktop: sidebar-guided placeholder */}
      <div className="hidden md:block">
        <DesktopBrandPlaceholder />
      </div>
    </>
  );
}

export default function BrandPage() {
  return (
    <Suspense
      fallback={
        <div className="md:hidden px-4 pt-4 space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[68px] rounded-2xl bg-white border border-gray-100 animate-pulse" />
          ))}
        </div>
      }
    >
      <BrandContent />
    </Suspense>
  );
}
