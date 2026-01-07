"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddCustomerModal({
  isOpen,
  onClose,
  onSuccess,
}: AddCustomerModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    gstin: "",
    state: "",
    stateCode: "",
    city: "",
    addressLine1: "",
    addressLine2: "",
    openingBalance: "0",
    openingAsOfDate: new Date().toISOString().split("T")[0],
    creditDays: "0",
    creditLimit: "0",
    hasPriceList: false,
    rateSheet: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          openingBalance: parseFloat(formData.openingBalance) || 0,
          creditDays: parseInt(formData.creditDays) || 0,
          creditLimit: parseFloat(formData.creditLimit) || 0,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create customer");
      }

      // Success
      onSuccess?.();
      onClose();

      // Reset form
      setFormData({
        name: "",
        email: "",
        phone: "",
        gstin: "",
        state: "",
        stateCode: "",
        city: "",
        addressLine1: "",
        addressLine2: "",
        openingBalance: "0",
        openingAsOfDate: new Date().toISOString().split("T")[0],
        creditDays: "0",
        creditLimit: "0",
        hasPriceList: false,
        rateSheet: "",
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

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
      // Small delay to ensure modal is rendered
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
          <h2 className="text-xl font-bold text-gray-900">Add New Customer</h2>
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
                  htmlFor="customer-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <Input
                  id="customer-name"
                  ref={firstInputRef}
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Enter customer name"
                />
              </div>
              <div>
                <label
                  htmlFor="customer-email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email
                </label>
                <Input
                  id="customer-email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="customer@example.com"
                />
              </div>
              <div>
                <label
                  htmlFor="customer-phone"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Phone
                </label>
                <Input
                  id="customer-phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  maxLength={20}
                  placeholder="+1 234 567 8900"
                />
              </div>
            </div>
          </div>

          {/* GST Details */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              GST Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="customer-gstin"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  GSTIN <span className="text-red-500">*</span>
                </label>
                <Input
                  id="customer-gstin"
                  type="text"
                  name="gstin"
                  value={formData.gstin}
                  onChange={handleChange}
                  required
                  maxLength={15}
                  placeholder="22AAAAA0000A1Z5"
                  className="uppercase"
                />
                <p className="text-xs text-gray-500 mt-1">15 characters</p>
              </div>
              <div>
                <label
                  htmlFor="customer-state-code"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  State Code <span className="text-red-500">*</span>
                </label>
                <Input
                  id="customer-state-code"
                  type="text"
                  name="stateCode"
                  value={formData.stateCode}
                  onChange={handleChange}
                  required
                  maxLength={2}
                  placeholder="27"
                />
                <p className="text-xs text-gray-500 mt-1">2 characters</p>
              </div>
              <div>
                <label
                  htmlFor="customer-state"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  State <span className="text-red-500">*</span>
                </label>
                <Input
                  id="customer-state"
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  required
                  placeholder="Maharashtra"
                />
              </div>
              <div>
                <label
                  htmlFor="customer-city"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  City <span className="text-red-500">*</span>
                </label>
                <Input
                  id="customer-city"
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  required
                  placeholder="Mumbai"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Address
            </h3>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="customer-address1"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Address Line 1 <span className="text-red-500">*</span>
                </label>
                <Input
                  id="customer-address1"
                  type="text"
                  name="addressLine1"
                  value={formData.addressLine1}
                  onChange={handleChange}
                  required
                  placeholder="Street address"
                />
              </div>
              <div>
                <label
                  htmlFor="customer-address2"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Address Line 2
                </label>
                <Input
                  id="customer-address2"
                  type="text"
                  name="addressLine2"
                  value={formData.addressLine2}
                  onChange={handleChange}
                  placeholder="Apartment, suite, etc. (optional)"
                />
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
                  htmlFor="customer-opening-balance"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Opening Balance
                </label>
                <Input
                  id="customer-opening-balance"
                  type="number"
                  name="openingBalance"
                  value={formData.openingBalance}
                  onChange={handleChange}
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label
                  htmlFor="customer-opening-date"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Opening As Of Date <span className="text-red-500">*</span>
                </label>
                <Input
                  id="customer-opening-date"
                  type="date"
                  name="openingAsOfDate"
                  value={formData.openingAsOfDate}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="customer-credit-days"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Credit Days
                </label>
                <Input
                  id="customer-credit-days"
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
                  htmlFor="customer-credit-limit"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Credit Limit
                </label>
                <Input
                  id="customer-credit-limit"
                  type="number"
                  name="creditLimit"
                  value={formData.creditLimit}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Pricing
            </h3>
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  id="customer-has-price-list"
                  type="checkbox"
                  name="hasPriceList"
                  checked={formData.hasPriceList}
                  onChange={handleChange}
                  className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                />
                <label
                  htmlFor="customer-has-price-list"
                  className="ml-2 text-sm text-gray-700"
                >
                  Customer has custom price list
                </label>
              </div>
              {formData.hasPriceList && (
                <div>
                  <label
                    htmlFor="customer-rate-sheet"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Rate Sheet
                  </label>
                  <Input
                    id="customer-rate-sheet"
                    type="text"
                    name="rateSheet"
                    value={formData.rateSheet}
                    onChange={handleChange}
                    placeholder="Rate sheet name or code"
                  />
                </div>
              )}
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
              className="bg-teal-500 hover:bg-teal-600 text-white"
            >
              {isSubmitting ? "Creating..." : "Create Customer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
