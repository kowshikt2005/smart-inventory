"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import {
  ShoppingBag, ShoppingCart, Package, User,
  X, KeyRound, LogOut, Loader2, Eye, EyeOff, ChevronRight, Play,
} from "lucide-react";
import { WelcomeModal } from "@/components/portal/WelcomeModal";
import { motion, AnimatePresence } from "motion/react";
import { useCart } from "@/components/portal/CartContext";
import { portalFetcher } from "@/lib/portal-fetcher";
import { cn } from "@/lib/utils";

// ── Change PIN form (shown inside account sheet) ──────────────────────────

function ChangePinForm({ onBack }: { onBack: () => void }) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPins, setShowPins] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPin !== confirmPin) {
      setError("New PIN and confirm PIN do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/portal/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to change PIN");
        return;
      }
      setSuccess(true);
      setTimeout(onBack, 1600);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const ready =
    currentPin.length === 6 && newPin.length === 6 && confirmPin.length === 6;

  const fields = [
    { label: "Current PIN", value: currentPin, set: setCurrentPin },
    { label: "New PIN", value: newPin, set: setNewPin },
    { label: "Confirm New PIN", value: confirmPin, set: setConfirmPin },
  ];

  return (
    <div className="px-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[#2D2A5E] font-medium"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          Back
        </button>
        <h3 className="text-sm font-bold text-[#1A1740]">Change PIN</h3>
        <div className="w-14" />
      </div>

      {success ? (
        <div className="py-8 text-center">
          <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <KeyRound className="h-6 w-6 text-green-600" />
          </div>
          <p className="text-sm font-semibold text-green-700">PIN changed successfully!</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
              {error}
            </p>
          )}

          {fields.map(({ label, value, set }) => (
            <div key={label} className="space-y-1.5">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1">
                {label}
              </label>
              <input
                type={showPins ? "text" : "password"}
                value={value}
                onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                placeholder="· · · · · ·"
                className="w-full h-12 px-3 rounded-xl border border-gray-200 text-base tracking-[0.35em] text-center focus:outline-none focus:ring-2 focus:ring-[#2D2A5E]/20 focus:border-[#2D2A5E]/50 transition-all bg-gray-50 focus:bg-white"
                required
              />
            </div>
          ))}

          <button
            type="button"
            onClick={() => setShowPins((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors pt-1"
          >
            {showPins ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPins ? "Hide PINs" : "Show PINs"}
          </button>

          <button
            type="submit"
            disabled={loading || !ready}
            className="w-full h-12 bg-[#2D2A5E] hover:bg-[#1A1740] disabled:bg-gray-100 disabled:text-gray-300 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Changing…</>
            ) : (
              "Change PIN"
            )}
          </button>
        </form>
      )}
    </div>
  );
}

// ── Account bottom sheet ──────────────────────────────────────────────────

function AccountSheet({ onClose }: { onClose: () => void }) {
  const [showChangePin, setShowChangePin] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const { clearCart } = useCart();

  const { data } = useSWR<{ customer: { name: string; customerNumber: string } }>(
    "/api/portal/me",
    portalFetcher,
    { shouldRetryOnError: false }
  );

  async function handleLogout() {
    clearCart();
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("portal-cart"))
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
    try {
      await fetch("/api/portal/logout", { method: "POST" });
    } catch { /* ignore */ }
    window.location.href = "/portal/login";
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        className="relative w-full bg-white rounded-t-3xl shadow-2xl overflow-hidden"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-0">
          <div className="w-9 h-1 bg-gray-200 rounded-full" />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {showChangePin ? (
            <motion.div
              key="pin"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <ChangePinForm onBack={() => setShowChangePin(false)} />
            </motion.div>
          ) : (
            <motion.div
              key="menu"
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {/* Close button */}
              <div className="flex items-center justify-between px-5 pt-3 pb-2">
                <h3 className="text-sm font-bold text-[#1A1740]">Account</h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Customer info */}
              {data?.customer && (
                <div className="mx-4 mb-3 rounded-2xl bg-gradient-to-r from-[#2D2A5E] to-[#1A1740] px-4 py-3.5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{data.customer.name}</p>
                    <p className="text-white/50 text-xs font-mono">{data.customer.customerNumber}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="px-3 pb-2 space-y-1">
                <button
                  type="button"
                  onClick={() => setShowChangePin(true)}
                  className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl hover:bg-gray-50 active:bg-gray-100 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <KeyRound className="h-4 w-4 text-[#2D2A5E]" />
                    </div>
                    <span className="text-sm font-medium text-[#1A1740]">Change PIN</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowTutorial(true)}
                  className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl hover:bg-gray-50 active:bg-gray-100 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Play className="h-4 w-4 text-amber-500" />
                    </div>
                    <span className="text-sm font-medium text-[#1A1740]">Watch Tutorial</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-red-50 active:bg-red-100 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                    <LogOut className="h-4 w-4 text-red-500" />
                  </div>
                  <span className="text-sm font-medium text-red-500">Sign out</span>
                </button>
              </div>

              {/* Safe area bottom padding */}
              <div className="h-4" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {showTutorial && (
        <WelcomeModal
          customerName={data?.customer?.name}
          onClose={() => setShowTutorial(false)}
        />
      )}
    </motion.div>
  );
}

// ── Bottom nav bar ────────────────────────────────────────────────────────

const NAV_TABS = [
  { href: "/portal/shop", icon: ShoppingBag, label: "Shop", hasBadge: false },
  { href: "/portal/cart", icon: ShoppingCart, label: "Cart",  hasBadge: true  },
  { href: "/portal/orders", icon: Package,      label: "Orders", hasBadge: false },
  { href: "#account",      icon: User,          label: "Account", hasBadge: false },
];

export function PortalBottomNav() {
  const pathname = usePathname();
  const { totalItems } = useCart();
  const [showAccount, setShowAccount] = useState(false);

  if (pathname === "/portal/login") return null;

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100"
        style={{ boxShadow: "0 -1px 0 0 rgb(0 0 0 / 0.04), 0 -4px 20px rgb(0 0 0 / 0.07)" }}
      >
        <div
          className="flex items-stretch h-16"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {NAV_TABS.map(({ href, icon: Icon, label, hasBadge }) => {
            const isAccount = href === "#account";
            const isActive =
              !isAccount &&
              (pathname === href ||
                (href === "/portal/shop" && pathname.startsWith("/portal/shop")));

            const inner = (
              <span className="flex flex-col items-center justify-center gap-[3px] flex-1 py-2 relative">
                {/* Active amber pill at top */}
                {isActive && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-[3px] bg-amber-400 rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}

                {/* Icon */}
                <span className="relative">
                  <Icon
                    className={cn(
                      "h-[22px] w-[22px] transition-all duration-150",
                      isActive ? "text-[#2D2A5E]" : "text-gray-400"
                    )}
                    strokeWidth={isActive ? 2.2 : 1.6}
                  />
                  {hasBadge && totalItems > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-amber-400 text-[#1A1740] text-[8px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                      {totalItems > 99 ? "99+" : totalItems}
                    </span>
                  )}
                </span>

                {/* Label */}
                <span
                  className={cn(
                    "text-[10px] font-medium transition-colors",
                    isActive ? "text-[#2D2A5E]" : "text-gray-400"
                  )}
                >
                  {label}
                </span>
              </span>
            );

            if (isAccount) {
              return (
                <button
                  key={href}
                  type="button"
                  onClick={() => setShowAccount(true)}
                  className="flex-1 flex active:bg-gray-50 transition-colors"
                >
                  {inner}
                </button>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className="flex-1 flex active:bg-gray-50 transition-colors"
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </nav>

      <AnimatePresence>
        {showAccount && <AccountSheet onClose={() => setShowAccount(false)} />}
      </AnimatePresence>
    </>
  );
}
