"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2, ShoppingBag, Loader2 } from "lucide-react";
import { useCart } from "@/components/portal/CartContext";

export default function CartPage() {
  const router = useRouter();
  const { items, totalAmount, updateQuantity, removeItem, clearCart } = useCart();
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = totalAmount;
  const gstAmount = items.reduce((sum, i) => {
    if ((i.discountPercent ?? 0) > 0) return sum;
    return sum + (i.sellingPrice * i.quantity * (i.gstRate ?? 0)) / 100;
  }, 0);
  const grandTotal = subtotal + gstAmount;

  async function handlePlaceOrder() {
    if (!items.length) return;
    setPlacing(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
          notes: "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to place order.");
        return;
      }
      clearCart();
      router.push(
        `/portal/order-confirmed?orderNumber=${encodeURIComponent(data.order.orderNumber)}&total=${encodeURIComponent(data.order.totalAmount)}`
      );
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setPlacing(false);
    }
  }

  // Empty
  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-6">
          <ShoppingBag className="h-8 w-8 text-gray-300" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
        <p className="text-gray-400 text-sm mb-8">Select items from the sidebar to get started.</p>
        <Link href="/portal/shop" className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#272462] hover:bg-[#1E1B4B] text-white font-medium rounded-xl text-sm transition-colors">
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Your Cart</h1>
        <p className="text-gray-400 text-sm mt-0.5">{items.length} item{items.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <div key={item.itemId} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-4">
              <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain p-1" />
                ) : (
                  <ShoppingBag className="h-5 w-5 text-gray-200" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 font-mono">{item.itemCode}</p>
                <p className="font-semibold text-gray-900 text-sm truncate">{item.name}</p>
                <p className="text-amber-600 font-medium text-sm mt-0.5">₹{item.sellingPrice.toFixed(2)} / {item.unit}</p>
              </div>

              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <button onClick={() => removeItem(item.itemId)} className="text-gray-300 hover:text-red-400 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
                <p className="text-sm font-bold text-gray-900">₹{(item.sellingPrice * item.quantity).toFixed(2)}</p>
                <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-lg p-0.5">
                  <button
                    onClick={() => updateQuantity(item.itemId, item.quantity - 1)}
                    className="w-7 h-7 rounded-md bg-white border border-gray-100 flex items-center justify-center text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="text-sm font-semibold text-gray-800 min-w-[24px] text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.itemId, item.quantity + 1)}
                    className="w-7 h-7 rounded-md bg-[#272462] flex items-center justify-center text-white hover:bg-[#1E1B4B] transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 lg:sticky lg:top-20">
            <h3 className="font-bold text-gray-900 mb-4">Order Summary</h3>
            <div className="space-y-2.5 text-sm mb-4">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span className="font-medium text-gray-900">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>GST</span>
                <span className="font-medium text-gray-900">₹{gstAmount.toFixed(2)}</span>
              </div>
              <div className="border-t border-dashed border-gray-100 pt-2.5 flex justify-between font-bold text-gray-900">
                <span>Total</span>
                <span className="text-amber-600 text-base">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-4">GST computed from item rates. Final amount confirmed on invoice.</p>

            {error && (
              <div className="bg-red-50 text-red-500 text-xs rounded-xl px-3 py-2.5 mb-3">{error}</div>
            )}

            <button
              onClick={handlePlaceOrder}
              disabled={placing}
              className="w-full bg-amber-400 hover:bg-amber-300 disabled:bg-gray-100 disabled:text-gray-400 text-[#1E1B4B] font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              {placing ? <><Loader2 className="h-4 w-4 animate-spin" />Placing…</> : "Place Order"}
            </button>

            <Link href="/portal/shop" className="block text-center text-sm text-gray-400 hover:text-indigo-600 mt-3 transition-colors">
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
