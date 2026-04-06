"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { getStateFromGSTIN } from "@/lib/gst-state-codes";
import { normalizeGstin, validateGstin } from "@/lib/gst-validation";
import { GstinVerifyButton, type GstinVerifyResult } from "@/components/ui/GstinVerifyButton";

interface AddVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (vendor: { id: string }) => void;
  prefillName?: string;
}

export function AddVendorModal({
  isOpen,
  onClose,
  onSuccess,
  prefillName,
}: AddVendorModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gstinWarning, setGstinWarning] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    gstin: "",
    state: "",
    city: "",
    address: "",
    pincode: "",
    openingBalance: "0",
    creditDays: "0",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/vendors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          openingBalance: parseFloat(formData.openingBalance) || 0,
          creditDays: parseInt(formData.creditDays) || 0,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create vendor");
      }

      // Success
      onSuccess?.(data);
      onClose();

      // Reset form
      setGstinWarning(null);
      setFormData({
        name: "",
        email: "",
        phone: "",
        gstin: "",
        state: "",
        city: "",
        address: "",
        pincode: "",
        openingBalance: "0",
        creditDays: "0",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name === "gstin") {
      const normalized = normalizeGstin(value);
      const stateInfo = getStateFromGSTIN(normalized);
      const validation = normalized.length > 0 ? validateGstin(normalized) : null;
      setGstinWarning(validation && !validation.valid ? (validation.error ?? null) : null);
      setFormData((prev) => ({
        ...prev,
        gstin: normalized,
        ...(stateInfo
          ? { state: stateInfo.stateName }
          : normalized.length < 2
            ? { state: "" }
            : {}),
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleGstinVerified = (result: GstinVerifyResult) => {
    setFormData((prev) => ({
      ...prev,
      name: prev.name.trim() ? prev.name : result.legalName,
      address: prev.address.trim() ? prev.address : result.address,
      city: prev.city.trim() ? prev.city : result.city,
      pincode: prev.pincode.trim() ? prev.pincode : result.pincode,
    }));
  };

  // Pre-fill name when redirected from an invoice page
  useEffect(() => {
    if (isOpen && prefillName) {
      setFormData((prev) => ({ ...prev, name: prefillName }));
    }
  }, [isOpen, prefillName]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Focus first input when modal opens
  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Add New Vendor</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="vendor-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Vendor Name <span className="text-red-500">*</span>
                </label>
                <Input
                  id="vendor-name"
                  ref={firstInputRef}
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Enter vendor name"
                />
              </div>
              <div>
                <label
                  htmlFor="vendor-email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email
                </label>
                <Input
                  id="vendor-email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="vendor@example.com"
                />
              </div>
              <div>
                <label
                  htmlFor="vendor-phone"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Phone
                </label>
                <Input
                  id="vendor-phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  maxLength={20}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="md:col-span-2">
                <label
                  htmlFor="vendor-gstin"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  GSTIN
                </label>
                <div className="flex gap-2">
                  <Input
                    id="vendor-gstin"
                    type="text"
                    name="gstin"
                    value={formData.gstin}
                    onChange={handleChange}
                    maxLength={15}
                    placeholder="22AAAAA0000A1Z5"
                    className="flex-1 font-mono uppercase"
                  />
                  <GstinVerifyButton
                    gstin={formData.gstin}
                    onVerified={handleGstinVerified}
                  />
                </div>
                {gstinWarning && (
                  <p className="text-xs text-amber-600 mt-1">{gstinWarning}</p>
                )}
              </div>
              <div>
                <label
                  htmlFor="vendor-pan"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  PAN
                </label>
                <Input
                  id="vendor-pan"
                  type="text"
                  value={formData.gstin.length >= 12 ? formData.gstin.substring(2, 12) : ""}
                  readOnly
                  placeholder="Auto-filled from GSTIN"
                  className="bg-gray-50 font-mono uppercase"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.gstin.length >= 12 ? "Auto-filled from GSTIN" : "Enter GSTIN to auto-fill"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State Code
                </label>
                <Input
                  type="text"
                  value={formData.gstin.length >= 2 ? formData.gstin.substring(0, 2) : ""}
                  readOnly
                  placeholder="Auto-filled from GSTIN"
                  className="bg-gray-50 font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.gstin.length >= 2 ? "Auto-filled from GSTIN" : "Enter GSTIN to auto-fill"}
                </p>
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Address Information
            </h3>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="vendor-address"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Address
                </label>
                <Input
                  id="vendor-address"
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Street address"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="vendor-city"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    City
                  </label>
                  <Input
                    id="vendor-city"
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="Mumbai"
                  />
                </div>
                <div>
                  <label
                    htmlFor="vendor-state"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    State
                  </label>
                  <Input
                    id="vendor-state"
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="Maharashtra"
                    readOnly={formData.gstin.length >= 2 && !!getStateFromGSTIN(formData.gstin)}
                    className={formData.gstin.length >= 2 && getStateFromGSTIN(formData.gstin) ? "bg-gray-100" : ""}
                  />
                  {formData.gstin.length >= 2 && getStateFromGSTIN(formData.gstin) && (
                    <p className="text-xs text-gray-500 mt-1">Auto-filled from GSTIN</p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="vendor-pincode"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Pincode
                  </label>
                  <Input
                    id="vendor-pincode"
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    maxLength={6}
                    placeholder="400001"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Financial Details */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Financial Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="vendor-credit-days"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Credit Days
                </label>
                <Input
                  id="vendor-credit-days"
                  type="number"
                  name="creditDays"
                  value={formData.creditDays}
                  onChange={handleChange}
                  min="0"
                  placeholder="0"
                />
              </div>
              <div>
                <label
                  htmlFor="vendor-opening-balance"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Opening Balance
                </label>
                <Input
                  id="vendor-opening-balance"
                  type="number"
                  name="openingBalance"
                  value={formData.openingBalance}
                  onChange={handleChange}
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {isSubmitting ? "Creating..." : "Create Vendor"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
