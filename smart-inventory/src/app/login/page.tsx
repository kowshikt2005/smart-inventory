"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, KeyRound } from "lucide-react";
import { TypewriterEffectSmooth } from "@/components/ui/aceternity/typewriter-effect";
import { AnimatedGridBackground } from "@/components/ui/aceternity/animated-background";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid credentials. Please try again.");
      } else if (result?.ok) {
        router.push(callbackUrl);
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const typewriterWords = [
    { text: "SRI", className: "text-slate-800" },
    { text: "BALAJI", className: "text-slate-800" },
    { text: "ENTERPRISES", className: "text-slate-800" },
  ];

  return (
    <AnimatedGridBackground className="flex items-center justify-center min-h-screen px-6 lg:px-16">
      <div className="w-full max-w-6xl flex items-center justify-between gap-12 lg:gap-24">

        {/* Left Side - Branding with Visual Anchoring */}
        <div className="hidden lg:flex flex-1 items-center">
          {/* Vertical Accent Line */}
          <div className="w-1.5 h-36 bg-gradient-to-b from-indigo-500 via-indigo-400 to-amber-400 rounded-full mr-10 shrink-0" />

          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.25em] text-slate-400 font-medium">
              welcome to
            </p>
            <TypewriterEffectSmooth
              words={typewriterWords}
              className="justify-start"
              cursorClassName="bg-amber-500"
            />
            <div className="flex items-center gap-4 pt-2">
              <span className="text-5xl xl:text-6xl font-bold text-amber-500 tracking-tight">
                ERP
              </span>
              <span className="text-sm text-slate-400 border-l border-slate-300 pl-4 leading-relaxed">
                Enterprise Resource<br />Planning System
              </span>
            </div>
          </div>
        </div>

        {/* Right Side - Login Card */}
        <div className="w-full max-w-[540px]">
          <div className="bg-gradient-to-b from-[#312E81] via-[#272462] to-[#1E1B4B] rounded-3xl shadow-2xl shadow-indigo-900/40 overflow-hidden ring-1 ring-white/[0.08]">

            {/* Card Header */}
            <div className="px-10 pt-10 pb-6">
              <div className="flex items-center justify-center gap-2.5 mb-3">
                <div className="w-8 h-[2px] bg-gradient-to-r from-transparent to-amber-400/60 rounded-full" />
                <span className="text-xs uppercase tracking-[0.2em] text-white/60 font-medium">
                  ERP Portal
                </span>
                <div className="w-8 h-[2px] bg-gradient-to-l from-transparent to-amber-400/60 rounded-full" />
              </div>
              <h1 className="text-2xl font-bold text-white text-center">
                Welcome Back
              </h1>
              <p className="text-sm text-white/50 text-center mt-1">
                Sign in to continue to your dashboard
              </p>
            </div>

            {/* Card Body */}
            <div className="px-10 pb-8">
              {error && (
                <div className="mb-6 p-3.5 bg-red-500/10 border border-red-400/20 rounded-xl backdrop-blur-sm">
                  <p className="text-red-300 text-sm text-center font-medium">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email Input */}
                <div className="space-y-2">
                  <label htmlFor="email" className="text-xs font-medium text-white/70 uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300/60">
                      <Mail className="h-4.5 w-4.5" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                      placeholder="name@company.com"
                      className="w-full h-[52px] pl-12 pr-4 bg-white/[0.07] hover:bg-white/[0.1] rounded-xl border border-white/[0.12] text-white placeholder-white/30 text-sm focus:outline-none focus:bg-white/[0.12] focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20 disabled:opacity-50 transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-2">
                  <label htmlFor="password" className="text-xs font-medium text-white/70 uppercase tracking-wider">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300/60">
                      <KeyRound className="h-4.5 w-4.5" />
                    </div>
                    <input
                      id="password"
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                      placeholder="Enter your password"
                      className="w-full h-[52px] pl-12 pr-4 bg-white/[0.07] hover:bg-white/[0.1] rounded-xl border border-white/[0.12] text-white placeholder-white/30 text-sm focus:outline-none focus:bg-white/[0.12] focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20 disabled:opacity-50 transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-2 border-white/30 bg-white/5 text-amber-500 focus:ring-amber-400 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-sm text-white/60 group-hover:text-white/90 transition-colors">
                      Remember me
                    </span>
                  </label>
                  <button
                    type="button"
                    className="text-sm text-white/50 hover:text-amber-300 underline-offset-4 hover:underline transition-colors"
                    onClick={() => alert("Please contact your administrator to reset your password")}
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Login Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-[52px] mt-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:from-amber-700 active:to-amber-800 text-white font-semibold rounded-xl shadow-lg shadow-amber-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <span className="tracking-wider text-[15px]">SIGN IN</span>
                  )}
                </button>
              </form>
            </div>

            {/* Card Footer */}
            <div className="border-t border-white/[0.06] bg-indigo-950/40 px-10 py-4">
              <p className="text-center text-xs text-white/30">
                powered by <span className="text-white/50 font-medium">ksolutions</span>
              </p>
            </div>
          </div>

          {/* Mobile Branding */}
          <div className="lg:hidden mt-8 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-medium">welcome to</p>
            <h1 className="text-2xl font-bold text-slate-800 mt-1">
              SRI BALAJI ENTERPRISES
            </h1>
            <h2 className="text-xl font-bold text-amber-500">
              ERP
            </h2>
          </div>
        </div>
      </div>
    </AnimatedGridBackground>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
