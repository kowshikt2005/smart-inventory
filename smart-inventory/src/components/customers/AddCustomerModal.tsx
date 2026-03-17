"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, Trash2, User, DollarSign } from "lucide-react";
import { getStateFromGSTIN } from "@/lib/gst-state-codes";
import { normalizeGstin, validateGstin } from "@/lib/gst-validation";
import { GstinVerifyButton, type GstinVerifyResult } from "@/components/ui/GstinVerifyButton";
import {
  RateSheetEditor,
  emptyRateSheetFormData,
  type RateSheetFormData,
} from "@/components/rate-sheets/RateSheetEditor";

interface ShippingAddr {
  label: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

const emptyAddress = (): ShippingAddr => ({
  label: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  isDefault: false,
});

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Tab = "customer" | "ratesheet";

export function AddCustomerModal({
  isOpen,
  onClose,
  onSuccess,
}: AddCustomerModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("customer");
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    contactName: "",
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
  });

  const [shippingAddresses, setShippingAddresses] = useState<ShippingAddr[]>([
    { ...emptyAddress(), isDefault: true },
  ]);
  const [sameAsBilling, setSameAsBilling] = useState(false);

  // Rate sheet
  const [enableRateSheet, setEnableRateSheet] = useState(false);
  const [rateSheetData, setRateSheetData] = useState<RateSheetFormData>(
    emptyRateSheetFormData
  );

  const resetForm = () => {
    setFormData({
      name: "",
      contactName: "",
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
    });
    setShippingAddresses([{ ...emptyAddress(), isDefault: true }]);
    setSameAsBilling(false);
    setEnableRateSheet(false);
    setRateSheetData(emptyRateSheetFormData);
    setActiveTab("customer");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Validate customer fields
    if (!formData.name.trim() || !formData.gstin.trim() || !formData.state.trim() || !formData.city.trim()) {
      setError("Please fill all required customer fields (name, GSTIN, state, city)");
      setActiveTab("customer");
      setIsSubmitting(false);
      return;
    }

    const normalizedGstin = normalizeGstin(formData.gstin);
    const gstValidation = validateGstin(normalizedGstin);
    if (!gstValidation.valid) {
      setError(gstValidation.error || "Invalid GSTIN");
      setActiveTab("customer");
      setIsSubmitting(false);
      return;
    }

    // Validate rate sheet if enabled
    if (enableRateSheet) {
      if (!rateSheetData.validFrom) {
        setError("Rate sheet valid-from date is required");
        setActiveTab("ratesheet");
        setIsSubmitting(false);
        return;
      }
    }

    try {
      // 1. Create customer
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          gstin: normalizedGstin,
          openingBalance: parseFloat(formData.openingBalance) || 0,
          creditDays: parseInt(formData.creditDays) || 0,
          creditLimit: parseFloat(formData.creditLimit) || 0,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create customer");

      const customerId = data.id;

      // 2. Create shipping addresses
      const validAddresses = shippingAddresses.filter(
        (a) => a.label.trim() && a.address.trim()
      );
      for (const addr of validAddresses) {
        await fetch(`/api/customers/${customerId}/shipping-addresses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(addr),
        });
      }

      // 3. Create rate sheet if enabled
      if (enableRateSheet) {
        const totalInclusions =
          rateSheetData.inclusionDiscounts.brands.length +
          rateSheetData.inclusionDiscounts.subBrands.length +
          rateSheetData.inclusionDiscounts.items.length;

        const generatedRateSheetName = `Rate Sheet - ${rateSheetData.validFrom} - ${data.name}`;

        const rsResponse = await fetch("/api/rate-sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: generatedRateSheetName,
            validFrom: rateSheetData.validFrom,
            validTo: rateSheetData.validTo || null,
            discountPercent: 0,
            customerIds: [customerId],
            isActive: rateSheetData.isActive,
            useInclusionModel: totalInclusions > 0,
            inclusionDiscounts: rateSheetData.inclusionDiscounts,
            excludedItemIds: [],
            excludedBrandIds: [],
            excludedSubBrandIds: [],
          }),
        });
        if (!rsResponse.ok) {
          const rsData = await rsResponse.json();
          setError(
            `Customer created, but rate sheet failed: ${rsData.error || "Unknown error"}`
          );
          onSuccess?.();
          return;
        }
      }

      onSuccess?.();
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
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

  const handleGstinVerified = (result: GstinVerifyResult) => {
    setFormData((prev) => ({
      ...prev,
      name: prev.name.trim() ? prev.name : result.legalName,
      addressLine1: prev.addressLine1.trim() ? prev.addressLine1 : result.addressLine1,
      addressLine2: prev.addressLine2.trim() ? prev.addressLine2 : result.addressLine2,
      city: prev.city.trim() ? prev.city : result.city,
    }));
  };

  const handleSameAsBillingChange = (checked: boolean) => {
    setSameAsBilling(checked);
    if (checked) {
      setShippingAddresses([
        {
          label: "Default",
          address: [formData.addressLine1, formData.addressLine2]
            .filter(Boolean)
            .join(", "),
          city: formData.city,
          state: formData.state,
          pincode: "",
          isDefault: true,
        },
      ]);
    }
  };

  const updateAddress = (
    index: number,
    field: keyof ShippingAddr,
    value: string | boolean
  ) => {
    setShippingAddresses((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === "isDefault" && value === true) {
        updated.forEach((a, i) => {
          if (i !== index) a.isDefault = false;
        });
      }
      return updated;
    });
  };

  const addAddress = () =>
    setShippingAddresses((prev) => [...prev, emptyAddress()]);

  const removeAddress = (index: number) => {
    setShippingAddresses((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length > 0 && !updated.some((a) => a.isDefault))
        updated[0].isDefault = true;
      return updated;
    });
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="shrink-0 border-b border-gray-200 px-6 pt-5 pb-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Add New Customer
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("customer")}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
                activeTab === "customer"
                  ? "bg-white text-teal-700 border-gray-200"
                  : "bg-gray-50 text-gray-500 border-transparent hover:text-gray-700"
              }`}
            >
              <User className="h-4 w-4" />
              Customer Info
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ratesheet")}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
                activeTab === "ratesheet"
                  ? "bg-white text-teal-700 border-gray-200"
                  : "bg-gray-50 text-gray-500 border-transparent hover:text-gray-700"
              }`}
            >
              <DollarSign className="h-4 w-4" />
              Rate Sheet
              {enableRateSheet && (
                <span className="bg-teal-100 text-teal-700 text-[10px] px-1.5 py-0.5 rounded-full">
                  ON
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-6"
        >
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          {/* ─── CUSTOMER INFO TAB ─── */}
          {activeTab === "customer" && (
            <>
              {/* Basic Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer Name <span className="text-red-500">*</span>
                    </label>
                    <Input
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <Input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="customer@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Name
                    </label>
                    <Input
                      type="text"
                      name="contactName"
                      value={formData.contactName}
                      onChange={handleChange}
                      placeholder="Primary contact person"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <Input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      maxLength={20}
                      placeholder="+91 98765 43210"
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      GSTIN <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        name="gstin"
                        value={formData.gstin}
                        onChange={handleChange}
                        required
                        maxLength={15}
                        placeholder="22AAAAA0000A1Z5"
                        className="flex-1 uppercase"
                      />
                      <GstinVerifyButton
                        gstin={formData.gstin}
                        onVerified={handleGstinVerified}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Format: 27ABCDE1234F1Z5</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State Code <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      name="stateCode"
                      value={formData.stateCode}
                      onChange={handleChange}
                      required
                      maxLength={2}
                      placeholder="27"
                      readOnly={
                        formData.gstin.length >= 2 &&
                        !!getStateFromGSTIN(formData.gstin)
                      }
                      className={
                        formData.gstin.length >= 2 &&
                        getStateFromGSTIN(formData.gstin)
                          ? "bg-gray-100"
                          : ""
                      }
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.gstin.length >= 2 &&
                      getStateFromGSTIN(formData.gstin)
                        ? "Auto-filled from GSTIN"
                        : "2 characters"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      PAN
                    </label>
                    <Input
                      type="text"
                      value={
                        formData.gstin.length >= 12
                          ? formData.gstin.substring(2, 12)
                          : ""
                      }
                      readOnly
                      placeholder="Auto-filled from GSTIN"
                      className="bg-gray-100 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      required
                      placeholder="Maharashtra"
                      readOnly={
                        formData.gstin.length >= 2 &&
                        !!getStateFromGSTIN(formData.gstin)
                      }
                      className={
                        formData.gstin.length >= 2 &&
                        getStateFromGSTIN(formData.gstin)
                          ? "bg-gray-100"
                          : ""
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City <span className="text-red-500">*</span>
                    </label>
                    <Input
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address Line 1 <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      name="addressLine1"
                      value={formData.addressLine1}
                      onChange={handleChange}
                      required
                      placeholder="Street address, building name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address Line 2
                    </label>
                    <Input
                      type="text"
                      name="addressLine2"
                      value={formData.addressLine2}
                      onChange={handleChange}
                      placeholder="Apartment, suite, floor (optional)"
                    />
                  </div>
                </div>
              </div>

              {/* Shipping Addresses */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Shipping Addresses
                  </h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sameAsBilling}
                      onChange={(e) =>
                        handleSameAsBillingChange(e.target.checked)
                      }
                      className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                    />
                    <span className="text-sm text-gray-700">
                      Same as billing
                    </span>
                  </label>
                </div>
                <div className="space-y-3">
                  {shippingAddresses.map((addr, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500 uppercase">
                            Address {idx + 1}
                          </span>
                          {addr.isDefault && (
                            <span className="text-[10px] font-medium bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!addr.isDefault && (
                            <button
                              type="button"
                              onClick={() =>
                                updateAddress(idx, "isDefault", true)
                              }
                              className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                            >
                              Set Default
                            </button>
                          )}
                          {shippingAddresses.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeAddress(idx)}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Label <span className="text-red-500">*</span>
                          </label>
                          <Input
                            value={addr.label}
                            onChange={(e) =>
                              updateAddress(idx, "label", e.target.value)
                            }
                            placeholder="e.g. Warehouse"
                            disabled={sameAsBilling}
                            className={sameAsBilling ? "bg-gray-100" : ""}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Address <span className="text-red-500">*</span>
                          </label>
                          <Input
                            value={addr.address}
                            onChange={(e) =>
                              updateAddress(idx, "address", e.target.value)
                            }
                            placeholder="Street / Building"
                            disabled={sameAsBilling}
                            className={sameAsBilling ? "bg-gray-100" : ""}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            City
                          </label>
                          <Input
                            value={addr.city}
                            onChange={(e) =>
                              updateAddress(idx, "city", e.target.value)
                            }
                            placeholder="City"
                            disabled={sameAsBilling}
                            className={sameAsBilling ? "bg-gray-100" : ""}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            State
                          </label>
                          <Input
                            value={addr.state}
                            onChange={(e) =>
                              updateAddress(idx, "state", e.target.value)
                            }
                            placeholder="State"
                            disabled={sameAsBilling}
                            className={sameAsBilling ? "bg-gray-100" : ""}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Pincode
                          </label>
                          <Input
                            value={addr.pincode}
                            onChange={(e) =>
                              updateAddress(idx, "pincode", e.target.value)
                            }
                            placeholder="Pincode"
                            disabled={sameAsBilling}
                            className={sameAsBilling ? "bg-gray-100" : ""}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {!sameAsBilling && (
                    <button
                      type="button"
                      onClick={addAddress}
                      className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium py-1"
                    >
                      <Plus className="h-4 w-4" />
                      Add Another Address
                    </button>
                  )}
                </div>
              </div>

              {/* Financial Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Financial Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Opening Balance
                    </label>
                    <Input
                      type="number"
                      name="openingBalance"
                      value={formData.openingBalance}
                      onChange={handleChange}
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Opening As Of Date{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      name="openingAsOfDate"
                      value={formData.openingAsOfDate}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Credit Days
                    </label>
                    <Input
                      type="number"
                      name="creditDays"
                      value={formData.creditDays}
                      onChange={handleChange}
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Credit Limit
                    </label>
                    <Input
                      type="number"
                      name="creditLimit"
                      value={formData.creditLimit}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ─── RATE SHEET TAB ─── */}
          {activeTab === "ratesheet" && (
            <>
              {/* Enable toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 border rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">
                    Enable Rate Sheet
                  </p>
                  <p className="text-sm text-gray-500">
                    Create a rate sheet with custom discounts for this customer
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={enableRateSheet}
                  onChange={(e) => setEnableRateSheet(e.target.checked)}
                  className="h-5 w-5 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                />
              </div>

              {enableRateSheet ? (
                <RateSheetEditor
                  value={rateSheetData}
                  onChange={setRateSheetData}
                  compact
                />
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">
                    Enable the toggle above to configure a rate sheet
                  </p>
                  <p className="text-xs mt-1">
                    You can also add rate sheets later from the customer detail
                    page
                  </p>
                </div>
              )}
            </>
          )}
        </form>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-gray-200">
          <div className="text-xs text-gray-400">
            {activeTab === "customer"
              ? "Fill customer details, then switch to Rate Sheet tab if needed"
              : enableRateSheet
                ? "Configure discounts, then create the customer"
                : "Enable rate sheet or go back to Customer Info"}
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-teal-500 hover:bg-teal-600 text-white"
            >
              {isSubmitting ? "Creating..." : "Create Customer"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
