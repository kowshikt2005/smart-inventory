"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { ShoppingCart, LogOut, User, KeyRound, X, Loader2, Eye, EyeOff } from "lucide-react";
import { useCart } from "@/components/portal/CartContext";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (r.status === 401 || r.status === 403) {
    window.location.href = "/portal/login";
    return null;
  }
  return r.json();
};

const PAGE_TITLES: Record<string, string> = {
  "/portal/shop": "Browse Catalog",
  "/portal/cart": "Your Cart",
  "/portal/orders": "My Orders",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.includes("/portal/shop/")) return "Products";
  return "Customer Portal";
}

function ChangePinModal({ onClose }: { onClose: () => void }) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPins, setShowPins] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
      setTimeout(() => onClose(), 1500);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const pinInputClass =
    "w-full h-10 px-3 rounded-lg border border-gray-200 text-sm tracking-[0.2em] text-center focus:outline-none focus:ring-2 focus:ring-indigo-400/40";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#2D2A5E] to-[#1E1B4B] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-amber-400" />
            <h3 className="text-white text-sm font-bold">Change PIN</h3>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="px-5 py-8 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <KeyRound className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-sm font-semibold text-green-700">PIN changed successfully!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Current PIN
              </label>
              <input
                type={showPins ? "text" : "password"}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                placeholder="------"
                className={pinInputClass}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                New PIN
              </label>
              <input
                type={showPins ? "text" : "password"}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                placeholder="------"
                className={pinInputClass}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Confirm New PIN
              </label>
              <input
                type={showPins ? "text" : "password"}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                placeholder="------"
                className={pinInputClass}
                required
              />
            </div>

            <button
              type="button"
              onClick={() => setShowPins((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPins ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showPins ? "Hide PINs" : "Show PINs"}
            </button>

            <button
              type="submit"
              disabled={loading || currentPin.length !== 6 || newPin.length !== 6 || confirmPin.length !== 6}
              className="w-full h-10 bg-[#272462] hover:bg-[#1E1B4B] disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Changing…
                </>
              ) : (
                "Change PIN"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function PortalTopbar() {
  const pathname = usePathname();
  const isLoginPage = pathname === "/portal/login";
  const [showChangePin, setShowChangePin] = useState(false);

  const { data } = useSWR<{ customer: { name: string; customerNumber: string } }>(
    isLoginPage ? null : "/api/portal/me",
    fetcher,
    { shouldRetryOnError: false }
  );
  const { totalItems } = useCart();

  async function handleLogout() {
    await fetch("/api/portal/logout", { method: "POST" });
    window.location.href = "/portal/login";
  }

  const customer = data?.customer;

  return (
    <>
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm h-14 flex items-center">
        <div className="w-full px-6 flex items-center justify-between">
          {/* Page title */}
          <p className="text-sm font-semibold text-gray-700">
            {getPageTitle(pathname)}
          </p>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {customer && (
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5">
                <User className="h-3.5 w-3.5 text-gray-400" />
                <span className="font-medium text-gray-700">{customer.name}</span>
                <span className="text-gray-300">&middot;</span>
                <span className="text-gray-400 text-xs font-mono">{customer.customerNumber}</span>
              </div>
            )}

            {/* Change PIN */}
            {customer && (
              <button
                onClick={() => setShowChangePin(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                aria-label="Change PIN"
                title="Change PIN"
              >
                <KeyRound className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Change PIN</span>
              </button>
            )}

            {/* Cart */}
            <Link
              href="/portal/cart"
              prefetch={false}
              className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-amber-50 transition-colors group"
              aria-label={`Cart (${totalItems} items)`}
            >
              <ShoppingCart className="h-5 w-5 text-gray-500 group-hover:text-amber-600 transition-colors" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              )}
            </Link>

            {/* Logout */}
            {customer && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Sign out</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {showChangePin && <ChangePinModal onClose={() => setShowChangePin(false)} />}
    </>
  );
}
