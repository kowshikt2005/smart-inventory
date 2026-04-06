"use client";

import { ShoppingBag } from "lucide-react";

export default function ShopPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-5">
        <ShoppingBag className="h-8 w-8 text-amber-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">Browse Our Catalog</h2>
      <p className="text-gray-400 text-sm max-w-xs">
        Select a brand from the sidebar to explore product ranges and place your order.
      </p>
    </div>
  );
}
