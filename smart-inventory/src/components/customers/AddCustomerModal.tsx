"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { getStateFromGSTIN } from "@/lib/gst-state-codes";

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
    shippingAddress: "",
    shippingAddressLine2: "",
    shippingCity: "",
    shippingState: "",
    openingBalance: "0",
    openingAsOfDate: new Date().toISOString().split("T")[0],
    creditDays: "0",
    creditLimit: "0",
    hasPriceList: false,
  });

  // Rate sheet state (created after customer)
  const [rateSheetData, setRateSheetData] = useState({
    name: "",
    validFrom: new Date().toISOString().split("T")[0],
    validTo: "",
    discountPercent: "0",
  });

  const [sameAsBilling, setSameAsBilling] = useState(false);

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

      // Create rate sheet if hasPriceList and name is filled
      if (formData.hasPriceList && rateSheetData.name.trim()) {
        const rsResponse = await fetch("/api/rate-sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: rateSheetData.name.trim(),
            validFrom: rateSheetData.validFrom,
            validTo: rateSheetData.validTo || null,
            discountPercent: parseFloat(rateSheetData.discountPercent) || 0,
            customerIds: [data.id],
            useInclusionModel: false,
            inclusionDiscounts: { brands: [], subBrands: [], items: [] },
            excludedItemIds: [],
            excludedBrandIds: [],
            excludedSubBrandIds: [],
          }),
        });
        if (!rsResponse.ok) {
          const rsData = await rsResponse.json();
          // Non-fatal: customer was created, just warn
          setError(`Customer created, but rate sheet failed: ${rsData.error || "Unknown error"}`);
          onSuccess?.();
          return;
        }
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
        shippingAddress: "",
        shippingAddressLine2: "",
        shippingCity: "",
        shippingState: "",
        openingBalance: "0",
        openingAsOfDate: new Date().toISOString().split("T")[0],
        creditDays: "0",
        creditLimit: "0",
        hasPriceList: false,
      });
      setRateSheetData({
        name: "",
        validFrom: new Date().toISOString().split("T")[0],
        validTo: "",
        discountPercent: "0",
      });
      setSameAsBilling(false);
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
    const { name, value, type } = e.target;

    if (name === "gstin") {
      const upperValue = value.toUpperCase();
      const stateInfo = getStateFromGSTIN(upperValue);
      setFormData((prev) => ({
        ...prev,
        gstin: upperValue,
        ...(stateInfo
          ? { stateCode: stateInfo.stateCode, state: stateInfo.stateName }
          : upperValue.length < 2
            ? { stateCode: "", state: "" }
            : {}),
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSameAsBillingChange = (checked: boolean) => {
    setSameAsBilling(checked);
    if (checked) {
      setFormData((prev) => ({
        ...prev,
        shippingAddress: prev.addressLine1,
        shippingAddressLine2: prev.addressLine2,
        shippingCity: prev.city,
        shippingState: prev.state,
      }));
    }
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
                  readOnly={formData.gstin.length >= 2 && !!getStateFromGSTIN(formData.gstin)}
                  className={formData.gstin.length >= 2 && getStateFromGSTIN(formData.gstin) ? "bg-gray-100" : ""}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.gstin.length >= 2 && getStateFromGSTIN(formData.gstin)
                    ? "Auto-filled from GSTIN"
                    : "2 characters"}
                </p>
              </div>
              <div>
                <label
                  htmlFor="customer-pan"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  PAN
                </label>
                <Input
                  id="customer-pan"
                  type="text"
                  value={formData.gstin.length >= 12 ? formData.gstin.substring(2, 12) : ""}
                  readOnly
                  placeholder="Auto-filled from GSTIN"
                  className="bg-gray-100 uppercase"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.gstin.length >= 12
                    ? "Auto-filled from GSTIN"
                    : "Enter GSTIN to auto-fill"}
                </p>
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
                  readOnly={formData.gstin.length >= 2 && !!getStateFromGSTIN(formData.gstin)}
                  className={formData.gstin.length >= 2 && getStateFromGSTIN(formData.gstin) ? "bg-gray-100" : ""}
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

          {/* Billing Address */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Billing Address
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
                  placeholder="Street address, building name"
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
                  placeholder="Apartment, suite, floor (optional)"
                />
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Shipping Address
              </h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sameAsBilling}
                  onChange={(e) => handleSameAsBillingChange(e.target.checked)}
                  className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                />
                <span className="text-sm text-gray-700">Same as billing address</span>
              </label>
            </div>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="customer-shipping-address"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Address Line 1 <span className="text-red-500">*</span>
                </label>
                <Input
                  id="customer-shipping-address"
                  type="text"
                  name="shippingAddress"
                  value={formData.shippingAddress}
                  onChange={handleChange}
                  required
                  disabled={sameAsBilling}
                  placeholder="Street address, building name"
                  className={sameAsBilling ? "bg-gray-100" : ""}
                />
              </div>
              <div>
                <label
                  htmlFor="customer-shipping-address2"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Address Line 2
                </label>
                <Input
                  id="customer-shipping-address2"
                  type="text"
                  name="shippingAddressLine2"
                  value={formData.shippingAddressLine2}
                  onChange={handleChange}
                  disabled={sameAsBilling}
                  placeholder="Apartment, suite, floor (optional)"
                  className={sameAsBilling ? "bg-gray-100" : ""}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="customer-shipping-city"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    City <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="customer-shipping-city"
                    type="text"
                    name="shippingCity"
                    value={formData.shippingCity}
                    onChange={handleChange}
                    required
                    disabled={sameAsBilling}
                    placeholder="City name"
                    className={sameAsBilling ? "bg-gray-100" : ""}
                  />
                </div>
                <div>
                  <label
                    htmlFor="customer-shipping-state"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    State <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="customer-shipping-state"
                    type="text"
                    name="shippingState"
                    value={formData.shippingState}
                    onChange={handleChange}
                    required
                    disabled={sameAsBilling}
                    placeholder="State name"
                    className={sameAsBilling ? "bg-gray-100" : ""}
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

          {/* Pricing / Rate Sheet */}
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
                  Create a rate sheet for this customer
                </label>
              </div>
              {formData.hasPriceList && (
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
                  <p className="text-xs text-gray-500">
                    A rate sheet will be created and linked to this customer. You can configure per-brand/item discounts from the Rate Sheets section later.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rate Sheet Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="text"
                        value={rateSheetData.name}
                        onChange={(e) => setRateSheetData((p) => ({ ...p, name: e.target.value }))}
                        placeholder="e.g. Special Discount 2026"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Global Discount %
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={rateSheetData.discountPercent}
                        onChange={(e) => setRateSheetData((p) => ({ ...p, discountPercent: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Valid From <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="date"
                        value={rateSheetData.validFrom}
                        onChange={(e) => setRateSheetData((p) => ({ ...p, validFrom: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Valid To
                      </label>
                      <Input
                        type="date"
                        value={rateSheetData.validTo}
                        onChange={(e) => setRateSheetData((p) => ({ ...p, validTo: e.target.value }))}
                      />
                    </div>
                  </div>
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
