"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ShoppingBag,
  Play,
  Search,
  ShoppingCart,
  PackageCheck,
  ArrowLeft,
} from "lucide-react";
import { motion } from "motion/react";
import { WelcomeModal } from "@/components/portal/WelcomeModal";

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
    } catch {
      // ignore
    }
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-12">
        {/* Hero section */}
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
            {customerName
              ? `Welcome back, ${customerName}`
              : "Welcome to Our Portal"}
          </h1>
          <p className="text-base text-gray-500 max-w-lg mx-auto leading-relaxed">
            Browse our catalog, add products to your cart, and place orders —
            all in one place.
          </p>
        </motion.div>

        {/* Quick-start step cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl mb-10">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
              className="bg-white rounded-xl border border-gray-100 p-5 text-center shadow-sm"
            >
              <div
                className={`w-10 h-10 rounded-xl ${step.bg} ${step.border} border flex items-center justify-center mx-auto mb-3`}
              >
                <step.icon className={`h-5 w-5 ${step.color}`} />
              </div>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">
                {step.title}
              </h3>
              <p className="text-xs leading-relaxed text-gray-400">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* CTA row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.55 }}
          className="flex flex-col sm:flex-row items-center gap-3"
        >
          <p className="text-sm text-gray-400 inline-flex items-center gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            Select a brand from the sidebar to get started
          </p>
          <span className="hidden sm:block text-gray-200">|</span>
          <button
            onClick={() => setShowWelcome(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#272462] hover:text-[#1E1B4B] transition-colors"
          >
            <Play className="h-3.5 w-3.5" />
            Watch Tutorial
          </button>
        </motion.div>
      </div>
    </>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-12">
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-5">
            <ShoppingBag className="h-7 w-7 text-amber-500" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">Welcome to Our Portal</h1>
          <p className="text-base text-gray-500 max-w-lg mx-auto leading-relaxed">
            Browse our catalog, add products to your cart, and place orders — all in one place.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl mb-10">
          {steps.map((step) => (
            <div key={step.title} className="bg-white rounded-xl border border-gray-100 p-5 text-center shadow-sm">
              <div className={`w-10 h-10 rounded-xl ${step.bg} ${step.border} border flex items-center justify-center mx-auto mb-3`}>
                <step.icon className={`h-5 w-5 ${step.color}`} />
              </div>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">{step.title}</h3>
              <p className="text-xs leading-relaxed text-gray-400">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    }>
      <ShopContent />
    </Suspense>
  );
}
