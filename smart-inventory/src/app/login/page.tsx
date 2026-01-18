"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, User, Lock } from "lucide-react";
import { BackgroundGradient } from "@/components/ui/aceternity/background-gradient";
import { TypewriterEffectSmooth } from "@/components/ui/aceternity/typewriter-effect";
import { TextGenerateEffect } from "@/components/ui/aceternity/text-generate-effect";
import { Button as MovingBorderButton } from "@/components/ui/aceternity/moving-border";
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

  useEffect(() => {
    const checkSession = async () => {
      const session = await getSession();
      if (session) {
        router.push(callbackUrl);
      }
    };
    checkSession();
  }, [router, callbackUrl]);

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
        setError("Invalid email or password");
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
    <GridBackground className="flex items-center justify-center px-8 lg:px-16">
      <div className="w-full max-w-6xl flex items-center justify-between gap-16 lg:gap-24">

        {/* Left Side - Branding */}
        <div className="hidden lg:block flex-1">
          <div className="space-y-1">
            <p className="text-lg text-slate-500 font-medium tracking-wide">
              welcome to
            </p>
            <TypewriterEffectSmooth
              words={typewriterWords}
              className="justify-start"
              cursorClassName="bg-orange-500"
            />
            <TextGenerateEffect
              words="ERP"
              className="text-4xl xl:text-5xl text-orange-500 mt-0"
              duration={0.5}
              filter={false}
            />
          </div>
        </div>

        {/* Right Side - Login Card */}
        <div className="w-full max-w-md">
          <BackgroundGradient className="rounded-xl" containerClassName="rounded-xl">
            <div className="bg-gradient-to-b from-[#4a7ab8] to-[#3d6a9e] rounded-xl shadow-xl overflow-hidden">
              {/* Card Header */}
              <div className="px-8 pt-8 pb-6">
                <h3 className="text-xl font-semibold text-white text-center">
                  Login to Your Account
                </h3>
                <div className="flex items-center justify-center mt-3">
                  <div className="flex-1 h-px bg-white/30"></div>
                  <div className="w-2 h-2 rounded-full bg-white/50 mx-2"></div>
                  <div className="flex-1 h-px bg-white/30"></div>
                </div>
              </div>

              {/* Card Body */}
              <div className="px-8 pb-4">
                {error && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                    <p className="text-red-700 text-sm text-center">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Username Input */}
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <User className="h-5 w-5" />
                    </div>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                      placeholder="Username"
                      className="w-full h-12 pl-11 pr-4 bg-white rounded-lg border-0 text-slate-700 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50"
                    />
                  </div>

                  {/* Password Input */}
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Lock className="h-5 w-5" />
                    </div>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                      placeholder="Password"
                      className="w-full h-12 pl-11 pr-4 bg-white rounded-lg border-0 text-slate-700 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50"
                    />
                  </div>

                  {/* Remember Me */}
                  <div className="flex items-center">
                    <input
                      id="remember"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-white/30 bg-white/20 text-blue-500 focus:ring-blue-300 focus:ring-offset-0 cursor-pointer"
                    />
                    <label
                      htmlFor="remember"
                      className="ml-2 text-sm text-white cursor-pointer select-none"
                    >
                      Remember Me
                    </label>
                  </div>

                  {/* Login Button with Moving Border */}
                  <MovingBorderButton
                    borderRadius="0.5rem"
                    className="bg-gradient-to-b from-[#5a9adb] to-[#3a7cbd] text-white font-semibold w-full h-12 border-0"
                    containerClassName="w-full h-12"
                    borderClassName="bg-[radial-gradient(#5a9adb_40%,transparent_60%)]"
                    duration={3000}
                    as="button"
                    type="submit"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Signing in...
                      </span>
                    ) : (
                      "LOGIN"
                    )}
                  </MovingBorderButton>
                </form>

                {/* Forgot Password */}
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    className="text-sm text-white/90 hover:text-white hover:underline transition-colors"
                    onClick={() => alert("Please contact your administrator to reset your password")}
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              {/* Card Footer */}
              <div className="bg-slate-100 px-8 py-4">
                <p className="text-center text-sm text-slate-500">
                  powered by <span className="font-semibold text-slate-700">ksolutions</span>
                </p>
              </div>
            </div>
          </BackgroundGradient>

          {/* Mobile Branding */}
          <div className="lg:hidden mt-8 text-center">
            <p className="text-sm text-slate-500 font-medium">welcome to</p>
            <h1 className="text-2xl font-bold text-slate-800">
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
