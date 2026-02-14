"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Settings, Loader2, AlertTriangle, Trash2, X, ShieldAlert } from "lucide-react";

interface AppSetting {
  id: string;
  key: string;
  value: string;
  label: string | null;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reset data state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/settings");
      if (!response.ok) throw new Error("Failed to fetch settings");
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: string) => {
    try {
      setSaving(key);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });

      if (!response.ok) throw new Error("Failed to update setting");

      const updated = await response.json();
      setSettings((prev) =>
        prev.map((s) => (s.key === key ? updated : s))
      );
      setSuccessMessage(`Setting updated successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update setting");
    } finally {
      setSaving(null);
    }
  };

  const getSettingValue = (key: string): string => {
    return settings.find((s) => s.key === key)?.value || "false";
  };

  const handleToggle = (key: string) => {
    const current = getSettingValue(key);
    const newValue = current === "true" ? "false" : "true";
    updateSetting(key, newValue);
  };

  const openResetModal = () => {
    setResetPassword("");
    setResetConfirmText("");
    setResetError(null);
    setShowResetModal(true);
    setTimeout(() => passwordInputRef.current?.focus(), 100);
  };

  const handleResetData = async () => {
    if (resetConfirmText !== "RESET ALL DATA") {
      setResetError('Please type "RESET ALL DATA" to confirm');
      return;
    }
    if (!resetPassword) {
      setResetError("Please enter your admin password");
      return;
    }

    try {
      setResetting(true);
      setResetError(null);

      const response = await fetch("/api/settings/reset-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset data");
      }

      setShowResetModal(false);
      setSuccessMessage("All business data has been reset successfully. User accounts are preserved.");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Failed to reset data");
    } finally {
      setResetting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500 shadow-md">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-500">
              Configure application behavior and preferences
            </p>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {successMessage}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Billing Settings */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">
                  Billing & Invoice Settings
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Control how invoices and billing are handled
                </p>
              </div>
              <div className="px-6 py-5">
                {/* Negative Billing Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-8">
                    <h3 className="text-sm font-medium text-gray-900">
                      Negative Billing
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      When enabled, invoices can be created even if the stock is
                      less than the ordered quantity. When disabled, invoice
                      creation will be blocked if there is insufficient stock.
                    </p>
                    <div className="mt-2">
                      {getSettingValue("negative_billing") === "true" ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          Invoices allowed without stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Stock validation enforced
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {saving === "negative_billing" && (
                      <Loader2 className="h-4 w-4 animate-spin text-teal-500" />
                    )}
                    <button
                      onClick={() => handleToggle("negative_billing")}
                      disabled={saving === "negative_billing"}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                        getSettingValue("negative_billing") === "true"
                          ? "bg-teal-500"
                          : "bg-gray-200"
                      } ${saving === "negative_billing" ? "opacity-50" : ""}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          getSettingValue("negative_billing") === "true"
                            ? "translate-x-5"
                            : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {/* Danger Zone — Admin Only */}
            {session?.user?.role === "ADMIN" && (
              <div className="bg-white rounded-xl border border-red-200 shadow-sm">
                <div className="px-6 py-4 border-b border-red-100 bg-red-50/50 rounded-t-xl">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-red-600" />
                    <h2 className="text-lg font-semibold text-red-900">
                      Danger Zone
                    </h2>
                  </div>
                  <p className="text-sm text-red-600/80 mt-1">
                    Irreversible actions — proceed with extreme caution
                  </p>
                </div>
                <div className="px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 pr-8">
                      <h3 className="text-sm font-medium text-gray-900">
                        Reset All Business Data
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Permanently delete all sales, purchases, inventory, customers,
                        vendors, ledger entries, bank accounts, and employees.
                        User accounts and login credentials will be preserved.
                      </p>
                      <p className="text-xs text-red-500 mt-2 font-medium">
                        This action cannot be undone.
                      </p>
                    </div>
                    <button
                      onClick={openResetModal}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                      Reset Data
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !resetting && setShowResetModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-red-50 px-6 py-4 border-b border-red-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-red-900">
                      Reset All Data
                    </h3>
                    <p className="text-xs text-red-600">
                      This action is permanent and irreversible
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => !resetting && setShowResetModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={resetting}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  This will permanently delete <strong>all business data</strong> including:
                </p>
                <ul className="mt-2 text-xs text-red-700 space-y-1 list-disc list-inside">
                  <li>Sales orders, invoices, and returns</li>
                  <li>Purchase orders, invoices, and returns</li>
                  <li>All inventory and stock movements</li>
                  <li>Customers, vendors, and employees</li>
                  <li>Ledger entries and payments</li>
                  <li>Bank accounts and transactions</li>
                  <li>Items, brands, and rate sheets</li>
                </ul>
              </div>

              {resetError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {resetError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Type <span className="font-mono font-bold text-red-600">RESET ALL DATA</span> to confirm
                </label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="RESET ALL DATA"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  disabled={resetting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Admin Password
                </label>
                <input
                  ref={passwordInputRef}
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Enter your admin password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  disabled={resetting}
                  onKeyDown={(e) => e.key === "Enter" && handleResetData()}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                disabled={resetting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResetData}
                disabled={resetting || resetConfirmText !== "RESET ALL DATA" || !resetPassword}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                {resetting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Reset All Data
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
