"use client";

import { useState } from "react";
import { X, KeyRound, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ChangePINModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ChangePINModal({ onClose, onSuccess }: ChangePINModalProps) {
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPin !== confirmPin) {
      setError("PINs do not match");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin: "123456", newPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to set PIN");
        return;
      }
      onSuccess();
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#2D2A5E] to-[#1E1B4B] px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-400/20 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-amber-400 text-xs font-semibold uppercase tracking-widest">
                  Security
                </p>
                <h2 className="text-white text-sm font-bold leading-tight">
                  Set Your Personal PIN
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors rounded-lg p-1 flex-shrink-0"
              aria-label="Dismiss"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-gray-500 text-sm leading-relaxed">
              You&apos;re using the{" "}
              <span className="font-semibold text-gray-700">default PIN</span>. Please
              set a personal 6-digit PIN to secure your account.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* New PIN */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  New PIN
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 pointer-events-none" />
                  <input
                    type={showNew ? "text" : "password"}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6-digit PIN"
                    value={newPin}
                    onChange={(e) =>
                      setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-10 text-sm text-gray-800 tracking-[0.2em] placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-[#2D2A5E]/20 focus:border-[#2D2A5E]/40 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                    aria-label={showNew ? "Hide PIN" : "Show PIN"}
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm PIN */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confirm PIN
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 pointer-events-none" />
                  <input
                    type={showConfirm ? "text" : "password"}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Repeat PIN"
                    value={confirmPin}
                    onChange={(e) =>
                      setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-10 text-sm text-gray-800 tracking-[0.2em] placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-[#2D2A5E]/20 focus:border-[#2D2A5E]/40 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                    aria-label={showConfirm ? "Hide PIN" : "Show PIN"}
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || newPin.length !== 6 || confirmPin.length !== 6}
                className="w-full mt-1 bg-[#272462] hover:bg-[#1E1B4B] disabled:bg-gray-100 disabled:text-gray-400 text-white text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Set PIN & Continue"
                )}
              </button>
            </form>
          </div>

          <div className="px-6 pb-5 text-center">
            <button
              onClick={onClose}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Remind me later
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
