"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { WelcomeModal } from "@/components/portal/WelcomeModal";

function ShopContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState(false);
  const [customerName, setCustomerName] = useState<string>();

  useEffect(() => {
    if (searchParams.get("welcome") === "1") {
      // Read customer name from the portal cookie payload (stored by login)
      try {
        const stored = document.cookie
          .split("; ")
          .find((c) => c.startsWith("portal-token="));
        if (stored) {
          const payload = JSON.parse(atob(stored.split(".")[1]));
          setCustomerName(payload.name);
        }
      } catch {
        // ignore
      }
      setShowWelcome(true);
      // Clean URL without re-render flash
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-5">
          <ShoppingBag className="h-8 w-8 text-amber-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Browse Our Catalog</h2>
        <p className="text-gray-400 text-sm max-w-xs">
          Select a brand from the sidebar to explore product ranges and place your order.
        </p>
      </div>
    </>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-5">
          <ShoppingBag className="h-8 w-8 text-amber-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Browse Our Catalog</h2>
        <p className="text-gray-400 text-sm max-w-xs">
          Select a brand from the sidebar to explore product ranges and place your order.
        </p>
      </div>
    }>
      <ShopContent />
    </Suspense>
  );
}
