"use client";

import useSWR from "swr";
import Link from "next/link";
import { Package, ShoppingBag, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useState } from "react";

function toTitleCase(str: string) {
  return str.replace(/_/g, " ").replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-600 border border-blue-100",
  CONFIRMED: "bg-indigo-50 text-indigo-600 border border-indigo-100",
  IN_PROGRESS: "bg-amber-50 text-amber-600 border border-amber-200",
  DELIVERED: "bg-green-50 text-green-600 border border-green-100",
  CANCELLED: "bg-red-50 text-red-500 border border-red-100",
  CLOSED: "bg-gray-50 text-gray-500 border border-gray-100",
};

function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);
  const statusStyle = STATUS_STYLES[order.status] ?? "bg-gray-50 text-gray-500 border border-gray-100";
  const date = new Date(order.orderDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Package className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm font-mono">{order.orderNumber}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {date} · {order.items.length} item{order.items.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${statusStyle}`}>
            {toTitleCase(order.status)}
          </span>
          <p className="text-sm font-bold text-gray-900 hidden sm:block">
            ₹{Number(order.totalAmount).toFixed(2)}
          </p>
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </div>

      <p className="sm:hidden px-4 pb-2 text-sm font-bold text-gray-900">
        ₹{Number(order.totalAmount).toFixed(2)}
      </p>

      {expanded && (
        <div className="border-t border-gray-50 px-4 py-3 space-y-2">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{item.item.name}</span>
              <div className="flex items-center gap-3 text-gray-400">
                <span>{Number(item.quantity)} {item.item.unit}</span>
                <span className="font-medium text-gray-800">₹{(Number(item.quantity) * Number(item.rate)).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  const { data, error, isLoading, mutate } = useSWR<{ orders: Order[] }>("/api/portal/orders", fetcher);
  const orders = data?.orders ?? [];

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
        {!isLoading && orders.length > 0 && (
          <p className="text-gray-400 text-sm mt-0.5">{orders.length} order{orders.length !== 1 ? "s" : ""}</p>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-24">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && !isLoading && (
        <div className="flex flex-col items-center gap-3 py-24">
          <p className="text-red-400 text-sm">Failed to load orders.</p>
          <button
            onClick={() => mutate()}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      )}

      {!isLoading && !error && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
            <ShoppingBag className="h-8 w-8 text-gray-300" />
          </div>
          <p className="font-semibold text-gray-700">No orders yet</p>
          <p className="text-gray-400 text-sm text-center max-w-xs">
            Browse the catalog and place your first order.
          </p>
          <Link href="/portal/shop" className="mt-2 px-6 py-2.5 bg-[#272462] hover:bg-[#1E1B4B] text-white text-sm font-medium rounded-xl transition-colors">
            Start Shopping
          </Link>
        </div>
      )}

      {!isLoading && orders.length > 0 && (
        <div className="space-y-3">
          {orders.map((order) => <OrderCard key={order.id} order={order} />)}
        </div>
      )}
    </div>
  );
}
