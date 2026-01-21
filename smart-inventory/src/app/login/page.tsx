"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, KeyRound } from "lucide-react";
import { TypewriterEffectSmooth } from "@/components/ui/aceternity/typewriter-effect";
import { GridBackground } from "@/components/ui/aceternity/dot-background";

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
    <GridBackground className="flex items-start justify-center px-8 lg:px-16 pt-24">
      <div className="w-full max-w-6xl flex items-center justify-between gap-12 lg:gap-20">

        {/* Left Side - Branding with Visual Anchoring */}
        <div className="hidden lg:flex flex-1 items-center">
          {/* Vertical Accent Line */}
          <div className="w-1 h-32 bg-gradient-to-b from-blue-500 via-blue-400 to-orange-400 rounded-full mr-8" />

          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400 font-medium">
              welcome to
            </p>
            <TypewriterEffectSmooth
              words={typewriterWords}
              className="justify-start"
              cursorClassName="bg-orange-500"
            />
            <div className="flex items-center gap-3 pt-1">
              <span className="text-4xl xl:text-5xl font-bold text-orange-500 tracking-tight">
                ERP
              </span>
              <span className="text-sm text-slate-400 border-l border-slate-300 pl-3">
                Enterprise Resource Planning
              </span>
            </div>
          </div>
        </div>

        {/* Right Side - Login Card */}
        <div className="w-full max-w-md">
          <div className="bg-gradient-to-b from-[#4a7ab8] to-[#3d6a9e] rounded-2xl shadow-2xl shadow-blue-900/20 overflow-hidden">

            {/* Card Header - Context-Rich */}
            <div className="px-8 pt-8 pb-5">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-white/60" />
                <span className="text-xs uppercase tracking-[0.15em] text-white/70 font-medium">
                  ERP Portal
                </span>
                <div className="w-2 h-2 rounded-full bg-white/60" />
              </div>
              <h1 className="text-xl font-semibold text-white text-center">
                Sign In
              </h1>
            </div>

            {/* Card Body */}
            <div className="px-8 pb-6">
              {error && (
                <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm text-center font-medium">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email Input - ERP Grade */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-xs font-medium text-white/80 uppercase tracking-wide">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <Mail className="h-4 w-4" />
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
                      className="w-full h-12 pl-11 pr-4 bg-white rounded-lg border-2 border-transparent text-slate-700 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-200/50 disabled:opacity-50 transition-all"
                    />
                  </div>
                </div>

                {/* Password Input - ERP Grade */}
                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-xs font-medium text-white/80 uppercase tracking-wide">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <KeyRound className="h-4 w-4" />
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
                      className="w-full h-12 pl-11 pr-4 bg-white rounded-lg border-2 border-transparent text-slate-700 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-200/50 disabled:opacity-50 transition-all"
                    />
                  </div>
                </div>

                {/* Remember Me & Forgot Password - Aligned */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-2 border-white/40 bg-white/10 text-blue-400 focus:ring-blue-300 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-sm text-white/80 group-hover:text-white transition-colors">
                      Remember me
                    </span>
                  </label>
                  <button
                    type="button"
                    className="text-sm text-white/70 hover:text-white underline-offset-2 hover:underline transition-colors"
                    onClick={() => alert("Please contact your administrator to reset your password")}
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Login Button - Authoritative & Decisive */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 mt-2 bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white font-semibold rounded-lg shadow-lg shadow-slate-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <span className="tracking-wide">SIGN IN</span>
                  )}
                </button>
              </form>
            </div>

            {/* Card Footer - Intentional & Subdued */}
            <div className="border-t border-white/10 bg-slate-800/30 px-8 py-3">
              <p className="text-center text-xs text-white/40">
                powered by <span className="text-white/60">ksolutions</span>
              </p>
            </div>
          </div>

          {/* Mobile Branding */}
          <div className="lg:hidden mt-8 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-medium">welcome to</p>
            <h1 className="text-2xl font-bold text-slate-800 mt-1">
              SRI BALAJI ENTERPRISES
            </h1>
            <h2 className="text-xl font-bold text-orange-500">
              ERP
            </h2>
          </div>
        </div>
      </div>
    </GridBackground>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
