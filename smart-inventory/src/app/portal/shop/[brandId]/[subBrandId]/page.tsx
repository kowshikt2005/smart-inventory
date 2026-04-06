"use client";

import { useState, Suspense } from "react";
import useSWR from "swr";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, Package, Plus, Minus, ShoppingCart, RefreshCw, ChevronRight } from "lucide-react";
import { useCart } from "@/components/portal/CartContext";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Item {
  id: string;
  name: string;
  itemCode: string;
  mrp: string;
  sellingPrice: string;
  unit: string;
  imageUrl: string | null;
  description: string | null;
  gstRate: string;
  inventory: { physicalStock: string } | null;
}

interface SubBrandDetail {
  id: string;
  name: string;
  brandId: string;
  discountPercent: string | null;
}

function ImageWithFallback({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <Package className="h-12 w-12 text-gray-200" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-contain p-4"
      onError={() => setFailed(true)}
    />
  );
}

function ItemCard({ item }: { item: Item }) {
  const { addItem, updateQuantity, items: cartItems } = useCart();
  const cartItem = cartItems.find((c) => c.itemId === item.id);
  const quantity = cartItem?.quantity ?? 0;

  const mrp = Number(item.mrp);
  const price = Number(item.sellingPrice);
  const gstRate = Number(item.gstRate);
  const hasDiscount = mrp > 0 && mrp > price;

  function handleAdd() {
    addItem({
      itemId: item.id,
      name: item.name,
      itemCode: item.itemCode,
      sellingPrice: price,
      mrp,
      unit: item.unit,
      imageUrl: item.imageUrl,
      gstRate,
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col">
      {/* Image */}
      <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center relative overflow-hidden">
        <ImageWithFallback src={item.imageUrl} alt={item.name} />
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <p className="text-xs text-gray-400 font-mono mb-1">{item.itemCode}</p>
        <p className="font-semibold text-gray-900 text-sm leading-snug mb-1">{item.name}</p>
        {item.description && (
          <p className="text-xs text-gray-400 leading-relaxed mb-2 line-clamp-2">{item.description}</p>
        )}

        <div className="flex items-baseline gap-2 mb-1 mt-auto">
          <span className="text-lg font-bold text-amber-600">₹{price.toFixed(2)}</span>
          {hasDiscount && (
            <span className="text-xs text-gray-400 line-through">₹{mrp.toFixed(2)}</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-3">per {item.unit}</p>

        {/* Cart control */}
        {quantity === 0 ? (
          <button
            onClick={handleAdd}
            className="w-full flex items-center justify-center gap-2 bg-[#272462] hover:bg-[#1E1B4B] text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
          >
            <ShoppingCart className="h-4 w-4" />
            Add to Cart
          </button>
        ) : (
          <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-1 py-1">
            <button
              onClick={() => updateQuantity(item.id, quantity - 1)}
              className="w-8 h-8 rounded-lg bg-white border border-indigo-100 flex items-center justify-center text-indigo-600 hover:bg-[#272462] hover:text-white hover:border-[#272462] transition-colors"
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="text-sm font-bold text-indigo-700 min-w-[2rem] text-center">
              {quantity}
            </span>
            <button
              onClick={() => updateQuantity(item.id, quantity + 1)}
              className="w-8 h-8 rounded-lg bg-[#272462] flex items-center justify-center text-white hover:bg-[#1E1B4B] transition-colors"
              aria-label="Increase quantity"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ItemsContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const subBrandId = params.subBrandId as string;
  const brandName = searchParams.get("brand");

  const { data, error, isLoading, mutate } = useSWR<{ subBrand: SubBrandDetail; items: Item[] }>(
    subBrandId ? `/api/portal/sub-brands/${subBrandId}/items` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const subBrand = data?.subBrand;
  const items = data?.items ?? [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      {/* Breadcrumb + header */}
      <div className="mb-6">
        {(brandName || subBrand) && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
            {brandName && <span>{brandName}</span>}
            {brandName && subBrand && <ChevronRight className="h-3 w-3" />}
            {subBrand && <span className="text-gray-600 font-medium">{subBrand.name}</span>}
          </div>
        )}
        <h1 className="text-xl font-bold text-gray-900">
          {subBrand ? subBrand.name : <span className="bg-gray-100 text-transparent rounded animate-pulse">Loading range…</span>}
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {isLoading ? "Loading…" : `${items.length} product${items.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
        </div>
      )}

      {/* Error with retry */}
      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <p className="text-red-400 text-sm">Failed to load products.</p>
          <button
            onClick={() => mutate()}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
            <Package className="h-8 w-8 text-gray-300" />
          </div>
          <p className="text-gray-400 text-sm">No products in this range.</p>
        </div>
      )}

      {/* Grid */}
      {!isLoading && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ItemsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
      </div>
    }>
      <ItemsContent />
    </Suspense>
  );
}
