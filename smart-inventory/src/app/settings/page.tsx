"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Settings, Loader2 } from "lucide-react";

interface AppSetting {
  id: string;
  key: string;
  value: string;
  label: string | null;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
