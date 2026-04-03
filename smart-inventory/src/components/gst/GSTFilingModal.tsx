"use client";

import { useState, useCallback } from "react";
import {
  Upload,
  X,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import type { GSTR1GovJSON } from "@/types/gst-gov-types";

type Step =
  | "credentials"
  | "captcha"
  | "login_otp"
  | "uploading"
  | "evc_otp"
  | "filing"
  | "done"
  | "error";

interface GSTFilingModalProps {
  govJson: GSTR1GovJSON | null;
  month: number;
  year: number;
  disabled?: boolean;
}

export function GSTFilingModal({
  govJson,
  month,
  year,
  disabled,
}: GSTFilingModalProps) {
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<Step>("credentials");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Session
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Credentials step
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Captcha step
  const [captchaImage, setCaptchaImage] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");

  // OTP steps
  const [loginOtp, setLoginOtp] = useState("");
  const [evcOtp, setEvcOtp] = useState("");

  // Result
  const [arn, setArn] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setStep("credentials");
    setLoading(false);
    setError(null);
    setSessionId(null);
    setUsername("");
    setPassword("");
    setCaptchaImage("");
    setCaptchaCode("");
    setLoginOtp("");
    setEvcOtp("");
    setArn(null);
  }, []);

  const handleOpen = () => {
    resetState();
    setShowModal(true);
  };

  const handleClose = () => {
    // Cleanup browser session if active
    if (sessionId) {
      fetch("/api/gst-portal/cleanup", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    }
    setShowModal(false);
    resetState();
  };

  // ── Step 1: Submit credentials → get captcha ──────────────────────────
  const handleSubmitCredentials = async () => {
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gst-portal/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to connect to GST portal");
      setSessionId(data.sessionId);
      setCaptchaImage(data.captchaImage);
      setStep("captcha");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Submit captcha → OTP sent to mobile ───────────────────────
  const handleSubmitCaptcha = async () => {
    if (!captchaCode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gst-portal/captcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, captcha: captchaCode.trim() }),
      });
      const data = await res.json();

      if (data.code === "INVALID_CAPTCHA") {
        // Wrong captcha — show new captcha image
        setError("Wrong captcha. Try again.");
        setCaptchaCode("");
        if (data.captchaImage) setCaptchaImage(data.captchaImage);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Captcha verification failed");

      if (data.step === "logged_in") {
        // No OTP needed — go straight to upload
        setStep("uploading");
        handleUpload();
      } else {
        setStep("login_otp");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Captcha failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Submit login OTP → auto-upload ────────────────────────────
  const handleSubmitLoginOtp = async () => {
    if (!loginOtp.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gst-portal/login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, otp: loginOtp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "OTP verification failed");

      // Logged in — proceed to upload
      setStep("uploading");
      setLoading(false);
      await handleUpload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP failed");
      setLoading(false);
    }
  };

  // ── Step 4: Auto-upload GSTR-1 JSON ───────────────────────────────────
  const handleUpload = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gst-portal/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, govJson, month, year }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setStep("evc_otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 5: Submit EVC OTP → file the return ──────────────────────────
  const handleSubmitEvcOtp = async () => {
    if (!evcOtp.trim()) return;
    setStep("filing");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gst-portal/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, evcOtp: evcOtp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Filing failed");

      setArn(data.arn || "Filed successfully");
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Filing failed");
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  // ── Step titles ───────────────────────────────────────────────────────
  const stepTitles: Record<Step, string> = {
    credentials: "GST Portal Login",
    captcha: "Solve Captcha",
    login_otp: "Enter Login OTP",
    uploading: "Uploading GSTR-1",
    evc_otp: "Enter EVC OTP to File",
    filing: "Filing GSTR-1",
    done: "GSTR-1 Filed",
    error: "Filing Error",
  };

  const stepDescriptions: Record<Step, string> = {
    credentials: "Enter your GST portal credentials to begin filing",
    captcha: "Type the characters shown in the image",
    login_otp: "OTP has been sent to your registered mobile",
    uploading: "Navigating portal and uploading your GSTR-1 data...",
    evc_otp: "GSTR-1 uploaded. Enter the EVC OTP sent to your mobile to file.",
    filing: "Filing your return on the GST portal...",
    done: "Your GSTR-1 has been filed successfully!",
    error: "Something went wrong during the filing process",
  };

  // ── Progress indicator ────────────────────────────────────────────────
  const stepOrder: Step[] = [
    "credentials",
    "captcha",
    "login_otp",
    "uploading",
    "evc_otp",
    "done",
  ];
  const currentStepIndex = stepOrder.indexOf(
    step === "filing" ? "evc_otp" : step === "error" ? "evc_otp" : step
  );

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled || !govJson}
        title={!govJson ? "Load GSTR-1 data first" : "File GSTR-1 on GST portal"}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 shadow-sm"
      >
        <Upload className="h-4 w-4" />
        File on Portal
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {stepTitles[step]}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {stepDescriptions[step]}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="px-5 pt-3">
              <div className="flex gap-1">
                {stepOrder.map((s, i) => (
                  <div
                    key={s}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= currentStepIndex
                        ? step === "error"
                          ? "bg-red-400"
                          : step === "done"
                            ? "bg-emerald-400"
                            : "bg-indigo-400"
                        : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              {/* ── Credentials step ─────────────────────────────────── */}
              {step === "credentials" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      GST Portal Username
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your GST username"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSubmitCredentials();
                      }}
                      placeholder="Enter your GST password"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    Credentials are used only to log into the GST portal and are
                    not stored anywhere.
                  </p>
                </>
              )}

              {/* ── Captcha step ─────────────────────────────────────── */}
              {step === "captcha" && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-gray-600">
                        Enter the code shown below
                      </label>
                      <button
                        type="button"
                        onClick={handleSubmitCredentials}
                        disabled={loading}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-40"
                      >
                        <RefreshCw
                          className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
                        />
                        Refresh
                      </button>
                    </div>
                    <div className="flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg h-16">
                      {captchaImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={captchaImage}
                          alt="Login captcha"
                          className="h-12 object-contain"
                          draggable={false}
                        />
                      ) : (
                        <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                      )}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={captchaCode}
                    onChange={(e) => setCaptchaCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSubmitCaptcha();
                    }}
                    placeholder="Captcha code"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-center tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    autoFocus
                  />
                </>
              )}

              {/* ── Login OTP step ───────────────────────────────────── */}
              {step === "login_otp" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Enter the OTP sent to your registered mobile
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={loginOtp}
                    onChange={(e) =>
                      setLoginOtp(e.target.value.replace(/\D/g, ""))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSubmitLoginOtp();
                    }}
                    placeholder="OTP"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-center tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    autoFocus
                  />
                </div>
              )}

              {/* ── Uploading step (auto, no user input) ─────────────── */}
              {step === "uploading" && (
                <div className="flex flex-col items-center py-6 gap-3">
                  <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                  <p className="text-sm text-gray-600 text-center">
                    Navigating portal and uploading your GSTR-1 data...
                    <br />
                    <span className="text-xs text-gray-400">
                      This may take 30-60 seconds
                    </span>
                  </p>
                </div>
              )}

              {/* ── EVC OTP step ─────────────────────────────────────── */}
              {step === "evc_otp" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Enter the EVC OTP sent to your registered mobile
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={evcOtp}
                    onChange={(e) =>
                      setEvcOtp(e.target.value.replace(/\D/g, ""))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSubmitEvcOtp();
                    }}
                    placeholder="EVC OTP"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-center tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    autoFocus
                  />
                </div>
              )}

              {/* ── Filing step (auto) ───────────────────────────────── */}
              {step === "filing" && (
                <div className="flex flex-col items-center py-6 gap-3">
                  <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                  <p className="text-sm text-gray-600">
                    Filing your GSTR-1 on the portal...
                  </p>
                </div>
              )}

              {/* ── Done step ────────────────────────────────────────── */}
              {step === "done" && (
                <div className="flex flex-col items-center py-6 gap-3">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                  <p className="text-sm font-medium text-gray-900">
                    GSTR-1 filed successfully!
                  </p>
                  {arn && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
                      <p className="text-xs text-emerald-600">
                        ARN:{" "}
                        <span className="font-mono font-semibold">{arn}</span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Error step ───────────────────────────────────────── */}
              {step === "error" && (
                <div className="flex flex-col items-center py-4 gap-3">
                  <AlertCircle className="h-10 w-10 text-red-400" />
                  <p className="text-sm text-gray-700 text-center">
                    The filing process encountered an issue. You may need to
                    complete the filing manually on the portal.
                  </p>
                </div>
              )}

              {/* ── Inline error ─────────────────────────────────────── */}
              {error && step !== "error" && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 pb-5">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                {step === "done" ? "Close" : "Cancel"}
              </button>

              {step === "credentials" && (
                <button
                  type="button"
                  onClick={handleSubmitCredentials}
                  disabled={!username.trim() || !password.trim() || loading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-500 rounded-md hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {loading ? "Connecting..." : "Login"}
                  {!loading && <ArrowRight className="h-3.5 w-3.5" />}
                </button>
              )}

              {step === "captcha" && (
                <button
                  type="button"
                  onClick={handleSubmitCaptcha}
                  disabled={!captchaCode.trim() || loading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-500 rounded-md hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {loading ? "Verifying..." : "Submit"}
                </button>
              )}

              {step === "login_otp" && (
                <button
                  type="button"
                  onClick={handleSubmitLoginOtp}
                  disabled={!loginOtp.trim() || loading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-500 rounded-md hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {loading ? "Verifying..." : "Verify OTP"}
                </button>
              )}

              {step === "evc_otp" && (
                <button
                  type="button"
                  onClick={handleSubmitEvcOtp}
                  disabled={!evcOtp.trim() || loading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-500 rounded-md hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {loading ? "Filing..." : "File GSTR-1"}
                </button>
              )}

              {step === "error" && (
                <button
                  type="button"
                  onClick={handleOpen}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-500 rounded-md hover:bg-indigo-600"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
