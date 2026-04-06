"use client";

import { useState } from "react";
import { ShieldCheck, ShieldAlert, RefreshCw, X, Loader2 } from "lucide-react";
import { validateGstin, normalizeGstin } from "@/lib/gst-validation";

export interface GstinVerifyResult {
  legalName: string;
  tradeName: string;
  status: string;
  address: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  pincode: string;
  businessType: string;
  stateCode: string;
  stateName: string;
}

interface GstinVerifyButtonProps {
  gstin: string;
  onVerified: (result: GstinVerifyResult) => void;
  disabled?: boolean;
}

export function GstinVerifyButton({ gstin, onVerified, disabled }: GstinVerifyButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [captchaImage, setCaptchaImage] = useState("");
  const [captchaCookie, setCaptchaCookie] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");
  const [fetchingCaptcha, setFetchingCaptcha] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedStatus, setVerifiedStatus] = useState<string | null>(null);

  const normalized = normalizeGstin(gstin);
  const isValidFormat = normalized.length === 15 && validateGstin(normalized).valid;

  const fetchCaptcha = async () => {
    setFetchingCaptcha(true);
    setError(null);
    setCaptchaCode("");
    try {
      const res = await fetch("/api/gstin-captcha");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load captcha");
      setCaptchaImage(data.captchaImage);
      setCaptchaCookie(data.captchaCookie);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load captcha");
    } finally {
      setFetchingCaptcha(false);
    }
  };

  const handleOpen = async () => {
    setVerifiedStatus(null);
    setError(null);
    setShowModal(true);
    await fetchCaptcha();
  };

  const handleClose = () => {
    setShowModal(false);
    setCaptchaImage("");
    setCaptchaCookie("");
    setCaptchaCode("");
    setError(null);
  };

  const handleVerify = async () => {
    if (!captchaCode || captchaCode.length !== 6) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/gstin-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gstin: normalized, captcha: captchaCode, captchaCookie }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Wrong captcha → auto-refresh captcha image
        if (data.code === "INVALID_CAPTCHA") {
          setError(data.error);
          await fetchCaptcha();
          return;
        }
        throw new Error(data.error ?? "Verification failed");
      }
      setVerifiedStatus(data.status);
      onVerified(data as GstinVerifyResult);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const isActive = verifiedStatus === "Active";
  const isCancelled = verifiedStatus && verifiedStatus !== "Active";

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled || !isValidFormat}
        title={!isValidFormat ? "Enter a valid 15-digit GSTIN first" : "Verify GSTIN on GST portal"}
        className={`
          shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border transition-colors
          ${isActive
            ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
            : isCancelled
              ? "bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
              : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400"
          }
          disabled:opacity-40 disabled:cursor-not-allowed
        `}
      >
        {isActive ? (
          <>
            <ShieldCheck className="h-3.5 w-3.5" />
            Active
          </>
        ) : isCancelled ? (
          <>
            <ShieldAlert className="h-3.5 w-3.5" />
            {verifiedStatus}
          </>
        ) : (
          <>
            <ShieldCheck className="h-3.5 w-3.5" />
            Verify
          </>
        )}
      </button>

      {/* Captcha modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Verify GSTIN</h3>
                <p className="text-xs text-gray-500 mt-0.5">{normalized}</p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              {/* Captcha image */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">
                    Enter the code shown below
                  </label>
                  <button
                    type="button"
                    onClick={fetchCaptcha}
                    disabled={fetchingCaptcha}
                    className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 disabled:opacity-40"
                  >
                    <RefreshCw className={`h-3 w-3 ${fetchingCaptcha ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                </div>

                <div className="flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg h-16">
                  {fetchingCaptcha ? (
                    <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                  ) : captchaImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={captchaImage}
                      alt="GSTIN captcha"
                      className="h-12 object-contain"
                      draggable={false}
                    />
                  ) : (
                    <span className="text-xs text-gray-400">Loading captcha...</span>
                  )}
                </div>
              </div>

              {/* Code input */}
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={captchaCode}
                  onChange={(e) => setCaptchaCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && captchaCode.length === 6) handleVerify();
                  }}
                  placeholder="6-digit code"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-center tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  autoFocus
                />
              </div>

              {/* Error */}
              {error && (
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
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerify}
                disabled={captchaCode.length !== 6 || verifying || fetchingCaptcha}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-500 rounded-md hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {verifying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {verifying ? "Verifying..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
