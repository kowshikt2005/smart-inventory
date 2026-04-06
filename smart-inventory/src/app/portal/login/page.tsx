"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { AnimatedGridBackground } from "@/components/ui/aceternity/animated-background";

export default function PortalLoginPage() {
  const router = useRouter();
  const [customerNumber, setCustomerNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerNumber.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerNumber: customerNumber.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid credentials. Please try again.");
        return;
      }
      router.push("/portal/shop");
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
              <div className="space-y-1">
                <p className="text-4xl xl:text-5xl font-bold text-slate-800 tracking-tight leading-tight">
                  SRI BALAJI
                </p>
                <p className="text-4xl xl:text-5xl font-bold text-slate-800 tracking-tight">
                  ENTERPRISES
                </p>
              </div>
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/logo-sbe.jpg?v=2"
                      alt="Sri Balaji Enterprises"
                      className="h-10 w-auto object-contain"
                    />
                  </div>
                </div>

                <h1 className="text-xl font-bold text-white text-center">
                  Welcome Back
                </h1>
                <p className="text-sm text-white/50 text-center mt-1">
                  Sign in to browse and place orders
                </p>
              </div>

              {/* Form */}
              <div className="px-10 pb-10">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Error */}
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">
                      {error}
                    </div>
                  )}

                  {/* Customer Number */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/60 uppercase tracking-wider">
                      Customer Number
                    </label>
                    <input
                      type="text"
                      autoComplete="username"
                      placeholder="e.g. CUST-0001"
                      value={customerNumber}
                      onChange={(e) => setCustomerNumber(e.target.value.toUpperCase())}
                      className="w-full bg-white/[0.07] border border-white/[0.12] rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm font-mono tracking-wide focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 transition-all"
                      required
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/60 uppercase tracking-wider">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white/[0.07] border border-white/[0.12] rounded-xl px-4 py-3 pr-12 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading || !customerNumber.trim() || !password}
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

                <div className="mt-4 text-center">
                  <a
                    href="/login"
                    className="text-xs text-white/30 hover:text-white/60 transition-colors"
                  >
                    Staff / Admin Login →
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
