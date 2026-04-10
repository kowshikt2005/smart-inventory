"use client";

import useSWR from "swr";
import Link from "next/link";
import { ShoppingBag, ChevronDown, RefreshCw, Package, ArrowRight } from "lucide-react";
import { useState } from "react";
import { portalFetcher } from "@/lib/portal-fetcher";

interface OrderItem {
  quantity: string;
  rate: string;
  item: { name: string; unit: string };
}

interface Order {
  id: string;
  orderNumber: string;
  orderDate: string;
  status: string;
  totalAmount: string;
  items: OrderItem[];
}

/* Customer-friendly status labels — matches SalesOrderStatus enum exactly */
const STATUS_MAP: Record<string, { label: string; dot: string; badge: string }> = {
  OPEN:               { label: "Order Placed",     dot: "bg-emerald-400",             badge: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  HOLD:               { label: "On Hold",           dot: "bg-orange-400",              badge: "bg-orange-50 text-orange-700 border border-orange-200" },
  REJECTED:           { label: "Rejected",          dot: "bg-red-400",                 badge: "bg-red-50 text-red-600 border border-red-200" },
  PARTIALLY_INVOICED: { label: "Partially Billed",  dot: "bg-amber-400 animate-pulse", badge: "bg-amber-50 text-amber-700 border border-amber-200" },
  FULLY_INVOICED:     { label: "Fully Billed",      dot: "bg-blue-400",                badge: "bg-blue-50 text-blue-700 border border-blue-200" },
};

function fmt(date: string) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function OrderCard({ order, index }: { order: Order; index: number }) {
  const [open, setOpen] = useState(false);
  const status = STATUS_MAP[order.status] ?? {
    label: order.status,
    dot: "bg-gray-400",
    badge: "bg-gray-50 text-gray-600 border border-gray-200",
  };
  const total = Number(order.totalAmount).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  });
  const itemCount = order.items.length;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-shadow hover:shadow-md"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Card header — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left"
        aria-expanded={open}
      >
        <div className="flex items-start gap-4 p-5">
          {/* Left: icon */}
          <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Package className="h-5 w-5 text-[#272462]" />
          </div>

          {/* Center: info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-bold text-gray-900 font-mono text-sm tracking-wide">
                {order.orderNumber}
              </span>
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${status.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot} flex-shrink-0`} />
                {status.label}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              {fmt(order.orderDate)} &middot; {itemCount} item{itemCount !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Right: amount + chevron */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-base font-extrabold text-gray-900 hidden sm:block">{total}</span>
            <div
              className={`w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            >
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Mobile total */}
        <p className="sm:hidden px-5 pb-4 text-sm font-bold text-gray-900 -mt-3">{total}</p>
      </button>

      {/* Expandable items */}
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: open ? `${order.items.length * 52 + 48}px` : "0px" }}
      >
        <div className="border-t border-gray-50 px-5 py-3 space-y-2.5">
          {order.items.map((item, i) => {
            const lineTotal = (Number(item.quantity) * Number(item.rate)).toLocaleString("en-IN", {
              style: "currency",
              currency: "INR",
              minimumFractionDigits: 2,
            });
            return (
              <div key={i} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700 truncate">{item.item.name}</span>
                </div>
                <div className="flex items-center gap-4 text-sm flex-shrink-0">
                  <span className="text-gray-400">
                    {Number(item.quantity)} {item.item.unit}
                  </span>
                  <span className="font-semibold text-gray-800 min-w-[80px] text-right">{lineTotal}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer total bar */}
        <div className="flex items-center justify-between bg-gray-50 border-t border-gray-100 px-5 py-3">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Order Total</span>
          <span className="text-sm font-extrabold text-[#272462]">{total}</span>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { data, error, isLoading, mutate } = useSWR<{ orders: Order[] }>("/api/portal/orders", portalFetcher, {
    revalidateOnFocus: false,
  });
  const orders = data?.orders ?? [];

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900">My Orders</h1>
        {!isLoading && orders.length > 0 && (
          <p className="text-gray-400 text-sm mt-1">
            {orders.length} order{orders.length !== 1 ? "s" : ""} placed
          </p>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-24">
          <div className="w-7 h-7 border-2 border-[#272462] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="flex flex-col items-center gap-4 py-24">
          <p className="text-red-400 text-sm">Could not load your orders.</p>
          <button
            onClick={() => mutate()}
            className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && orders.length === 0 && (
        <div className="flex flex-col items-center py-24 gap-5 text-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center">
              <ShoppingBag className="h-9 w-9 text-[#272462]/30" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center">
              <span className="text-amber-600 text-[10px] font-bold">0</span>
            </div>
          </div>
          <div>
            <p className="font-bold text-gray-800 text-lg">No orders yet</p>
            <p className="text-gray-400 text-sm mt-1 max-w-xs">
              Browse the catalog and place your first order — it will appear here.
            </p>
          </div>
          <Link
            href="/portal/shop"
            className="flex items-center gap-2 mt-1 px-6 py-3 bg-[#272462] hover:bg-[#1E1B4B] text-white text-sm font-bold rounded-xl transition-colors"
          >
            Start Shopping
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* Orders list */}
      {!isLoading && !error && orders.length > 0 && (
        <div className="space-y-3">
          {orders.map((order, i) => (
            <OrderCard key={order.id} order={order} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
