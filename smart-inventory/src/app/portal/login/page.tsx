"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Phone, KeyRound } from "lucide-react";

import { AnimatedGridBackground } from "@/components/ui/aceternity/animated-background";
import { useCompanyBranding } from "@/hooks/use-company-branding";

export default function PortalLoginPage() {
  const router = useRouter();
  const { branding } = useCompanyBranding();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lockoutSeconds === null || lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() || !pin) return;
    setLoading(true);
    setError(null);
    setLockoutSeconds(null);
    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429 && data.remainingSeconds) {
          setLockoutSeconds(data.remainingSeconds);
        }
        setError(data.error || "Invalid credentials. Please try again.");
        return;
      }
      router.push(data.isDefaultPin ? "/portal/shop?changePIN=1" : "/portal/shop");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white">
      <AnimatedGridBackground className="flex items-center justify-center min-h-screen px-6 lg:px-16">
        <div className="w-full max-w-5xl flex items-center justify-between gap-12 lg:gap-24">

          {/* Left — Branding */}
          <div className="hidden lg:flex flex-1 items-center">
            <div className="w-1.5 h-36 bg-gradient-to-b from-indigo-500 via-indigo-400 to-amber-400 rounded-full mr-10 shrink-0" />
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400 font-medium">
                welcome to
              </p>
              <p className="text-4xl xl:text-5xl font-bold text-slate-800 tracking-tight leading-tight">
                {branding.companyName}
              </p>
              <div className="flex items-center gap-4 pt-2">
                <span className="text-4xl xl:text-5xl font-bold text-amber-500 tracking-tight">
                  B2B
                </span>
                <span className="text-sm text-slate-400 border-l border-slate-300 pl-4 leading-relaxed">
                  Customer<br />Ordering Portal
                </span>
              </div>
            </div>
          </div>

          {/* Right — Login card */}
          <div className="w-full max-w-[480px]">
            <div className="bg-gradient-to-b from-indigo-900 via-indigo-950 to-[#1E1B4B] rounded-3xl shadow-2xl shadow-indigo-900/40 overflow-hidden ring-1 ring-white/[0.08]">

              {/* Card header */}
              <div className="px-10 pt-10 pb-6">
                <div className="flex items-center justify-center gap-2.5 mb-3">
                  <div className="w-8 h-[2px] bg-gradient-to-r from-transparent to-amber-400/60 rounded-full" />
                  <span className="text-xs uppercase tracking-[0.2em] text-white/60 font-medium">
                    Customer Portal
                  </span>
                  <div className="w-8 h-[2px] bg-gradient-to-l from-transparent to-amber-400/60 rounded-full" />
                </div>

                {/* Logo */}
                <div className="flex justify-center mb-4">
                  <div className="bg-white rounded-xl px-6 py-2">
                    {branding.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={branding.logoUrl} alt={`${branding.companyName} logo`} className="h-10 w-auto object-contain" />
                    ) : (
                      <span className="text-sm font-semibold text-indigo-950">{branding.companyName}</span>
                    )}
                  </div>
                </div>

                <h1 className="text-xl font-bold text-white text-center">
                  Welcome Back
                </h1>
                <p className="text-sm text-white/50 text-center mt-1">
                  Sign in with your phone number &amp; PIN
                </p>
              </div>

              {/* Form */}
              <div className="px-10 pb-10">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Error */}
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">
                      {lockoutSeconds !== null ? `Too many login attempts. Please wait ${Math.floor(lockoutSeconds / 60)}m ${lockoutSeconds % 60}s before trying again.` : error}
                    </div>
                  )}

                  {/* Phone Number */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/60 uppercase tracking-wider">
                      Phone Number
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300/60">
                        <Phone className="h-4 w-4" />
                      </div>
                      <input
                        type="tel"
                        autoComplete="tel"
                        placeholder="e.g. 9876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-white/[0.07] border border-white/[0.12] rounded-xl pl-12 pr-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* 6-Digit PIN */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/60 uppercase tracking-wider">
                      6-Digit PIN
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300/60">
                        <KeyRound className="h-4 w-4" />
                      </div>
                      <input
                        type={showPin ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="Enter your 6-digit PIN"
                        value={pin}
                        onChange={(e) => {
                          // Only allow digits, max 6
                          const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                          setPin(val);
                        }}
                        inputMode="numeric"
                        maxLength={6}
                        className="w-full bg-white/[0.07] border border-white/[0.12] rounded-xl pl-12 pr-12 py-3 text-white placeholder-white/30 text-sm tracking-[0.2em] focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin((v) => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                        aria-label={showPin ? "Hide PIN" : "Show PIN"}
                      >
                        {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading || !phone.trim() || pin.length !== 6}
                    className="w-full mt-2 bg-amber-400 hover:bg-amber-300 disabled:bg-white/10 disabled:text-white/30 text-[#1E1B4B] font-bold py-3 rounded-xl transition-all duration-150 flex items-center justify-center gap-2 text-sm"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing in…
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </button>
                </form>

                <p className="mt-6 text-center text-xs text-white/25">
                  Contact your sales representative for access credentials
                </p>

                <div className="mt-5 pt-4 border-t border-white/[0.08] text-center">
                  <a
                    href="/login"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/[0.15] text-sm text-white/60 hover:text-white hover:border-amber-400/40 hover:bg-white/[0.05] transition-all"
                  >
                    Staff / Admin Login
                    <span className="text-amber-400/70">&rarr;</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AnimatedGridBackground>
    </div>
  );
}
