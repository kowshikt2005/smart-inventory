"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, User, Lock } from "lucide-react";
import { GoogleButton } from "@/components/auth/GoogleButton";

function TypewriterText({ text, className }: { text: string; className?: string }) {
  const [displayText, setDisplayText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text]);

  return <span className={className}>{displayText}<span className="animate-pulse">|</span></span>;
}

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

  // Check if user is already logged in
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
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 flex items-center justify-center px-16 py-8">
      <div className="w-full h-full flex items-center justify-between gap-32 max-w-[1600px]">
        {/* Left Side - Title with Typewriter Effect */}
        <div className="flex-1 space-y-8 animate-fade-in-left">
          <div className="space-y-4">
            <h1 className="text-8xl font-black tracking-tight">
              <TypewriterText
                text="SRI BALAJI ENTERPRISES"
                className="text-blue-600 drop-shadow-lg"
              />
            </h1>
            <h2 className="text-7xl font-black tracking-tight pl-2">
              <TypewriterText
                text="ERP"
                className="text-orange-500 drop-shadow-lg"
              />
            </h2>
          </div>
        </div>

        {/* Right Side - Login Card */}
        <div className="w-full max-w-xl animate-fade-in-right">
          <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-3xl shadow-2xl p-12 transform transition-all duration-500 hover:scale-[1.02] hover:shadow-3xl">
            {/* Header */}
            <div className="text-center mb-10 animate-slide-down">
              <h3 className="text-3xl font-bold text-white tracking-wide">
                Login to Your Account
              </h3>
              <div className="w-24 h-1 bg-white/30 mx-auto mt-4 rounded-full"></div>
            </div>

            {error && (
              <div className="mb-6 animate-shake">
                <Alert className="border-red-300 bg-red-50/90 backdrop-blur">
                  <AlertDescription className="text-red-700 font-medium">
                    {error}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Input */}
              <div className="group animate-slide-up" style={{ animationDelay: "0.1s" }}>
                <div className="relative transform transition-all duration-300 group-hover:scale-[1.02]">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-hover:text-blue-600">
                    <User className="h-6 w-6" />
                  </div>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    className="pl-14 h-14 bg-white/95 backdrop-blur border-0 text-gray-700 placeholder:text-gray-400 rounded-xl font-medium text-lg shadow-lg transition-all duration-300 focus:shadow-xl focus:bg-white"
                    placeholder="Username"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="group animate-slide-up" style={{ animationDelay: "0.2s" }}>
                <div className="relative transform transition-all duration-300 group-hover:scale-[1.02]">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-hover:text-blue-600">
                    <Lock className="h-6 w-6" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    className="pl-14 h-14 bg-white/95 backdrop-blur border-0 text-gray-700 placeholder:text-gray-400 rounded-xl font-medium text-lg shadow-lg transition-all duration-300 focus:shadow-xl focus:bg-white"
                    placeholder="Password"
                  />
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between animate-slide-up" style={{ animationDelay: "0.3s" }}>
                <div className="flex items-center group cursor-pointer">
                  <input
                    id="remember"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-5 w-5 rounded-lg border-2 border-white/40 bg-white/20 text-blue-600 focus:ring-2 focus:ring-white focus:ring-offset-0 cursor-pointer transition-all duration-300 hover:scale-110"
                  />
                  <label htmlFor="remember" className="ml-3 text-base text-white font-medium cursor-pointer select-none transition-all duration-300 group-hover:text-white/90">
                    Remember Me
                  </label>
                </div>

                <button
                  type="button"
                  className="text-base text-white/90 hover:text-white font-medium underline decoration-2 underline-offset-4 transition-all duration-300 hover:scale-105"
                  onClick={() => alert("Please contact your administrator to reset your password")}
                >
                  Forgot Password?
                </button>
              </div>

              {/* Login Button */}
              <div className="animate-slide-up" style={{ animationDelay: "0.4s" }}>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-14 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 hover:from-blue-600 hover:via-blue-700 hover:to-blue-800 text-white text-xl font-bold shadow-xl rounded-xl border-0 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl active:scale-95"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-6 w-6 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      LOGIN
                      <svg className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </Button>
              </div>
            </form>

            {/* Divider */}
            <div className="relative my-8 animate-slide-up" style={{ animationDelay: "0.5s" }}>
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-white/30" />
              </div>
              <div className="relative flex justify-center text-base">
                <span className="px-4 bg-blue-600 text-white font-medium">Or continue with</span>
              </div>
            </div>

            {/* Google Sign In */}
            <div className="animate-slide-up" style={{ animationDelay: "0.6s" }}>
              <GoogleButton disabled={isLoading} />
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fade-in-left {
          from {
            opacity: 0;
            transform: translateX(-50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes fade-in-right {
          from {
            opacity: 0;
            transform: translateX(50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }

        .animate-fade-in-left {
          animation: fade-in-left 0.8s ease-out;
        }

        .animate-fade-in-right {
          animation: fade-in-right 0.8s ease-out;
        }

        .animate-slide-down {
          animation: slide-down 0.6s ease-out;
        }

        .animate-slide-up {
          animation: slide-up 0.6s ease-out forwards;
          opacity: 0;
        }

        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }

        .shadow-3xl {
          box-shadow: 0 35px 60px -15px rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
