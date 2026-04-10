"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  X, Plus, Trash2, User, DollarSign, Settings,
  Pencil, Loader2, Check, KeyRound, Tag,
} from "lucide-react";
import { getStateFromGSTIN } from "@/lib/gst-state-codes";
import { normalizeGstin, validateGstin } from "@/lib/gst-validation";
import { GstinVerifyButton, type GstinVerifyResult } from "@/components/ui/GstinVerifyButton";
import {
  RateSheetEditor,
  emptyRateSheetFormData,
  type RateSheetFormData,
  type InclusionDiscounts,
} from "@/components/rate-sheets/RateSheetEditor";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ShippingAddr {
  id?: string;         // present for existing saved addresses
  label: string;
  gstin: string;       // UI-only: used for GST autofill, not saved
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactName: string;
  contactPhone: string;
  isDefault: boolean;
}

interface ExistingRateSheet {
  id: string;
  name: string;
  discountPercent: number;
  isActive: boolean;
  validFrom: string;
  validTo: string | null;
  useInclusionModel: boolean;
  inclusionDiscounts?: InclusionDiscounts;
}

interface Brand {
  id: string;
  name: string;
  isActive: boolean;
}

export interface EditCustomer {
  id: string;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  gstin: string;
  stateCode: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  pincode?: string | null;
  creditDays: number;
  creditLimit: number;
  openingBalance: number;
  openingAsOfDate: string;
  portalPassword?: string | null;
  preferredBrands?: { brandId: string }[];
}

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (customer: { id: string }) => void;
  prefillName?: string;
  editCustomer?: EditCustomer | null;
  initialTab?: Tab;
}

type Tab = "customer" | "ratesheet" | "settings";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const emptyAddress = (): ShippingAddr => ({
  label: "", gstin: "", address: "", city: "", state: "",
  pincode: "", contactName: "", contactPhone: "", isDefault: false,
});

function getRSStatus(rs: ExistingRateSheet) {
  if (!rs.isActive) return { label: "Inactive", color: "bg-gray-100 text-gray-600" };
  const now = new Date();
  const from = new Date(rs.validFrom);
  const to = rs.validTo ? new Date(rs.validTo) : null;
  if (from > now) return { label: "Pending", color: "bg-yellow-100 text-yellow-700" };
  if (to && to < now) return { label: "Expired", color: "bg-red-100 text-red-700" };
  return { label: "Active", color: "bg-green-100 text-green-700" };
}

function fmtDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddCustomerModal({
  isOpen,
  onClose,
  onSuccess,
  prefillName,
  editCustomer,
  initialTab,
}: AddCustomerModalProps) {
  const isEditMode = !!editCustomer;

  // ── Core form state ──────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("customer");
  const firstInputRef = useRef<HTMLInputElement>(null);
  const addressesInitialized = useRef(false);

  const [formData, setFormData] = useState({
    name: "", contactName: "", email: "", phone: "",
    gstin: "", state: "", stateCode: "", city: "", pincode: "",
    addressLine1: "", addressLine2: "",
    openingBalance: "0", openingAsOfDate: new Date().toISOString().split("T")[0],
    creditDays: "0", creditLimit: "0",
  });

  const [shippingAddresses, setShippingAddresses] = useState<ShippingAddr[]>([
    { ...emptyAddress(), isDefault: true },
  ]);
  const [deletedAddressIds, setDeletedAddressIds] = useState<string[]>([]);
  const [sameAsBilling, setSameAsBilling] = useState(false);

  // ── Create-mode rate sheet ────────────────────────────────────────────────
  const [enableRateSheet, setEnableRateSheet] = useState(false);
  const [rateSheetData, setRateSheetData] = useState<RateSheetFormData>(emptyRateSheetFormData);

  // ── Edit-mode rate sheet editor ───────────────────────────────────────────
  const [showRSEditor, setShowRSEditor] = useState(false);
  const [editingRSId, setEditingRSId] = useState<string | null>(null);
  const [rsEditorData, setRSEditorData] = useState<RateSheetFormData>(emptyRateSheetFormData);
  const [savingRS, setSavingRS] = useState(false);

  // ── Edit-mode settings ────────────────────────────────────────────────────
  const [portalPin, setPortalPin] = useState("");
  const [savingPortal, setSavingPortal] = useState(false);
  const [portalMsg, setPortalMsg] = useState<string | null>(null);
  const [preferredBrandIds, setPreferredBrandIds] = useState<string[]>([]);
  const [savingBrands, setSavingBrands] = useState(false);
  const [brandsMsg, setBrandsMsg] = useState<string | null>(null);

  // ── SWR — edit mode only ──────────────────────────────────────────────────
  const { data: addressesData } = useSWR(
    isOpen && isEditMode ? `/api/customers/${editCustomer!.id}/shipping-addresses` : null
  );
  const { data: rateSheetsData, mutate: mutateRateSheets } = useSWR(
    isOpen && isEditMode ? `/api/rate-sheets?customerId=${editCustomer!.id}` : null
  );
  const { data: brandsData } = useSWR(
    isOpen && isEditMode ? "/api/brands?activeOnly=true" : null
  );

  const existingRateSheets: ExistingRateSheet[] = rateSheetsData?.rateSheets ?? [];
  const allBrands: Brand[] = brandsData?.brands ?? [];

  // ── Reset helpers ─────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormData({
      name: "", contactName: "", email: "", phone: "",
      gstin: "", state: "", stateCode: "", city: "", pincode: "",
      addressLine1: "", addressLine2: "",
      openingBalance: "0", openingAsOfDate: new Date().toISOString().split("T")[0],
      creditDays: "0", creditLimit: "0",
    });
    setShippingAddresses([{ ...emptyAddress(), isDefault: true }]);
    setDeletedAddressIds([]);
    setSameAsBilling(false);
    setEnableRateSheet(false);
    setRateSheetData(emptyRateSheetFormData);
    setShowRSEditor(false);
    setEditingRSId(null);
    setRSEditorData(emptyRateSheetFormData);
    setPortalPin("");
    setPreferredBrandIds([]);
    setPortalMsg(null);
    setBrandsMsg(null);
    setActiveTab("customer");
    setError(null);
  };

  // ── Effects ───────────────────────────────────────────────────────────────

  // Reset addressesInitialized when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      addressesInitialized.current = false;
    }
  }, [isOpen]);

  // Populate from editCustomer when modal opens in edit mode
  useEffect(() => {
    if (isOpen && editCustomer) {
      const editStartTab = initialTab === "settings" || initialTab === "ratesheet" ? initialTab : "customer";
      setFormData({
        name: editCustomer.name || "",
        contactName: editCustomer.contactName || "",
        email: editCustomer.email || "",
        phone: editCustomer.phone || "",
        gstin: editCustomer.gstin || "",
        state: editCustomer.state || "",
        stateCode: editCustomer.stateCode || "",
        city: editCustomer.city || "",
        pincode: editCustomer.pincode || "",
        addressLine1: editCustomer.addressLine1 || "",
        addressLine2: editCustomer.addressLine2 || "",
        openingBalance: String(editCustomer.openingBalance ?? 0),
        openingAsOfDate: editCustomer.openingAsOfDate?.split("T")[0] || new Date().toISOString().split("T")[0],
        creditDays: String(editCustomer.creditDays ?? 0),
        creditLimit: String(editCustomer.creditLimit ?? 0),
      });
      setPortalPin(editCustomer.portalPassword ?? "");
      setPreferredBrandIds(editCustomer.preferredBrands?.map((b) => b.brandId) ?? []);
      setDeletedAddressIds([]);
      setShowRSEditor(false);
      setEditingRSId(null);
      setRSEditorData(emptyRateSheetFormData);
      setActiveTab(editStartTab);
      setError(null);
    }
  }, [isOpen, editCustomer, initialTab]);

  // Populate shipping addresses from API (only once per modal open)
  useEffect(() => {
    if (isEditMode && addressesData?.addresses && !addressesInitialized.current) {
      addressesInitialized.current = true;
      const loaded = addressesData.addresses.map((a: Record<string, unknown>) => ({
        id: a.id as string,
        label: (a.label as string) || "",
        gstin: "",
        address: (a.address as string) || "",
        city: (a.city as string) || "",
        state: (a.state as string) || "",
        pincode: (a.pincode as string) || "",
        contactName: (a.contactName as string) || "",
        contactPhone: (a.contactPhone as string) || "",
        isDefault: a.isDefault as boolean,
      }));
      setShippingAddresses(loaded.length > 0 ? loaded : [{ ...emptyAddress(), isDefault: true }]);
    }
  }, [addressesData, isEditMode]);

  // Prefill name for create mode
  useEffect(() => {
    if (isOpen && !isEditMode && prefillName) {
      setFormData((prev) => ({ ...prev, name: prefillName }));
    }
  }, [isOpen, prefillName, isEditMode]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && isOpen) onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Focus first input on open
  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // ── Handlers: form fields ─────────────────────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (name === "gstin") {
      const upper = value.toUpperCase();
      const stateInfo = getStateFromGSTIN(upper);
      setFormData((prev) => ({
        ...prev,
        gstin: upper,
        ...(stateInfo ? { stateCode: stateInfo.stateCode, state: stateInfo.stateName }
          : upper.length < 2 ? { stateCode: "", state: "" } : {}),
      }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleGstinVerified = (result: GstinVerifyResult) => {
    setFormData((prev) => ({
      ...prev,
      name: prev.name.trim() ? prev.name : (result.tradeName || result.legalName),
      contactName: prev.contactName.trim() ? prev.contactName : result.legalName,
      addressLine1: prev.addressLine1.trim() ? prev.addressLine1 : result.addressLine1,
      addressLine2: prev.addressLine2.trim() ? prev.addressLine2 : result.addressLine2,
      city: prev.city.trim() ? prev.city : result.city,
      pincode: prev.pincode.trim() ? prev.pincode : result.pincode,
    }));
  };

  // ── Handlers: shipping addresses ──────────────────────────────────────────

  const handleShippingGstinVerified = (idx: number, result: GstinVerifyResult) => {
    setShippingAddresses((prev) => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        address: updated[idx].address.trim() ? updated[idx].address : result.addressLine1,
        city: updated[idx].city.trim() ? updated[idx].city : result.city,
        state: updated[idx].state.trim() ? updated[idx].state : result.stateName,
        pincode: updated[idx].pincode.trim() ? updated[idx].pincode : result.pincode,
      };
      return updated;
    });
  };

  const handleSameAsBillingChange = (checked: boolean) => {
    setSameAsBilling(checked);
    if (checked) {
      setShippingAddresses([{
        label: "Default", gstin: "",
        address: [formData.addressLine1, formData.addressLine2].filter(Boolean).join(", "),
        city: formData.city, state: formData.state, pincode: "",
        contactName: "", contactPhone: "", isDefault: true,
      }]);
    }
  };

  const updateAddress = (index: number, field: keyof ShippingAddr, value: string | boolean) => {
    setShippingAddresses((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === "isDefault" && value === true) {
        updated.forEach((a, i) => { if (i !== index) a.isDefault = false; });
      }
      return updated;
    });
  };

  const addAddress = () => setShippingAddresses((prev) => [...prev, emptyAddress()]);

  const removeAddress = (index: number) => {
    setShippingAddresses((prev) => {
      const addr = prev[index];
      if (addr.id) setDeletedAddressIds((ids) => [...ids, addr.id!]);
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length > 0 && !updated.some((a) => a.isDefault)) updated[0].isDefault = true;
      return updated;
    });
  };

  // ── Handlers: rate sheets (edit mode) ────────────────────────────────────

  const openNewRS = () => {
    setEditingRSId(null);
    setRSEditorData({
      ...emptyRateSheetFormData,
      name: `Rate Sheet - ${new Date().toISOString().split("T")[0]}`,
    });
    setShowRSEditor(true);
  };

  const openEditRS = (rs: ExistingRateSheet) => {
    setEditingRSId(rs.id);
    setRSEditorData({
      name: rs.name,
      validFrom: rs.validFrom.split("T")[0],
      validTo: rs.validTo ? rs.validTo.split("T")[0] : "",
      discountPercent: String(rs.discountPercent),
      isActive: rs.isActive,
      inclusionDiscounts: rs.inclusionDiscounts || { brands: [], subBrands: [], items: [] },
    });
    setShowRSEditor(true);
  };

  const handleSaveRS = async () => {
    if (!rsEditorData.validFrom) { alert("Valid-from date is required"); return; }
    setSavingRS(true);
    try {
      const url = editingRSId ? `/api/rate-sheets/${editingRSId}` : "/api/rate-sheets";
      const method = editingRSId ? "PUT" : "POST";
      const totalInclusions =
        rsEditorData.inclusionDiscounts.brands.length +
        rsEditorData.inclusionDiscounts.subBrands.length +
        rsEditorData.inclusionDiscounts.items.length;
      const name = rsEditorData.name?.trim() ||
        `Rate Sheet - ${rsEditorData.validFrom} - ${editCustomer?.name || ""}`;
      const payload: Record<string, unknown> = {
        name, validFrom: rsEditorData.validFrom, validTo: rsEditorData.validTo || null,
        discountPercent: 0, isActive: rsEditorData.isActive,
        useInclusionModel: totalInclusions > 0,
        inclusionDiscounts: rsEditorData.inclusionDiscounts,
        excludedItemIds: [], excludedBrandIds: [], excludedSubBrandIds: [],
      };
      if (!editingRSId) payload.customerIds = [editCustomer!.id];
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed to save"); }
      await mutateRateSheets();
      setShowRSEditor(false);
      setEditingRSId(null);
      setRSEditorData(emptyRateSheetFormData);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save rate sheet");
    } finally { setSavingRS(false); }
  };

  const handleDeleteRS = async (rsId: string) => {
    if (!confirm("Delete this rate sheet?")) return;
    try {
      const res = await fetch(`/api/rate-sheets/${rsId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await mutateRateSheets();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete rate sheet");
    }
  };

  // ── Handlers: portal & brands (edit mode) ─────────────────────────────────

  const handleSavePortal = async () => {
    if (portalPin && !/^\d{6}$/.test(portalPin)) {
      setPortalMsg("PIN must be exactly 6 digits");
      return;
    }
    setSavingPortal(true);
    setPortalMsg(null);
    try {
      const res = await fetch(`/api/customers/${editCustomer!.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portalPassword: portalPin || null }),
      });
      if (!res.ok) throw new Error();
      setPortalMsg("Saved");
      setTimeout(() => setPortalMsg(null), 2000);
    } catch { setPortalMsg("Failed to save"); }
    finally { setSavingPortal(false); }
  };

  const handleSaveBrands = async () => {
    setSavingBrands(true);
    setBrandsMsg(null);
    try {
      const res = await fetch(`/api/customers/${editCustomer!.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredBrandIds }),
      });
      if (!res.ok) throw new Error();
      setBrandsMsg("Saved");
      setTimeout(() => setBrandsMsg(null), 2000);
    } catch { setBrandsMsg("Failed to save"); }
    finally { setSavingBrands(false); }
  };

  // ── Main submit ───────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!formData.name.trim() || !formData.phone.trim() || !formData.gstin.trim() ||
      !formData.state.trim() || !formData.city.trim() || !formData.pincode.trim()) {
      setError("Please fill all required fields (name, phone, GSTIN, state, city, pincode)");
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

    try {
      if (isEditMode) {
        // 1. Update customer
        const res = await fetch(`/api/customers/${editCustomer!.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            gstin: normalizedGstin,
            openingBalance: parseFloat(formData.openingBalance) || 0,
            creditDays: parseInt(formData.creditDays) || 0,
            creditLimit: parseFloat(formData.creditLimit) || 0,
          }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Failed to update customer");

        // 2. Delete removed addresses
        for (const addrId of deletedAddressIds) {
          await fetch(
            `/api/customers/${editCustomer!.id}/shipping-addresses/${addrId}`,
            { method: "DELETE" }
          );
        }

        // 3. Sync remaining addresses
        for (const { gstin: _g, id: addrId, ...addrData } of shippingAddresses) {
          if (addrId) {
            await fetch(
              `/api/customers/${editCustomer!.id}/shipping-addresses/${addrId}`,
              {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(addrData),
              }
            );
          } else {
            await fetch(
              `/api/customers/${editCustomer!.id}/shipping-addresses`,
              {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(addrData),
              }
            );
          }
        }

        onSuccess?.({ id: editCustomer!.id });
        onClose();
      } else {
        // ── Create mode ──
        if (enableRateSheet && !rateSheetData.validFrom) {
          setError("Rate sheet valid-from date is required");
          setActiveTab("ratesheet");
          setIsSubmitting(false);
          return;
        }

        const response = await fetch("/api/customers", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData, gstin: normalizedGstin,
            openingBalance: parseFloat(formData.openingBalance) || 0,
            creditDays: parseInt(formData.creditDays) || 0,
            creditLimit: parseFloat(formData.creditLimit) || 0,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to create customer");

        const customerId = data.id;

        for (const { gstin: _gstin, ...addr } of shippingAddresses.filter(
          (a) => a.label.trim() && a.address.trim()
        )) {
          await fetch(`/api/customers/${customerId}/shipping-addresses`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(addr),
          });
        }

        if (enableRateSheet) {
          const totalInclusions =
            rateSheetData.inclusionDiscounts.brands.length +
            rateSheetData.inclusionDiscounts.subBrands.length +
            rateSheetData.inclusionDiscounts.items.length;
          const rsRes = await fetch("/api/rate-sheets", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: `Rate Sheet - ${rateSheetData.validFrom} - ${data.name}`,
              validFrom: rateSheetData.validFrom,
              validTo: rateSheetData.validTo || null,
              discountPercent: 0, customerIds: [customerId],
              isActive: rateSheetData.isActive,
              useInclusionModel: totalInclusions > 0,
              inclusionDiscounts: rateSheetData.inclusionDiscounts,
              excludedItemIds: [], excludedBrandIds: [], excludedSubBrandIds: [],
            }),
          });
          if (!rsRes.ok) {
            const rsData = await rsRes.json();
            setError(`Customer created, but rate sheet failed: ${rsData.error || "Unknown error"}`);
            onSuccess?.(data);
            return;
          }
        }

        onSuccess?.(data);
        onClose();
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const gstAutoFilled = formData.gstin.length >= 2 && !!getStateFromGSTIN(formData.gstin);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* ── Header ── */}
        <div className="shrink-0 border-b border-gray-200 px-6 pt-5 pb-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              {isEditMode ? `Edit Customer` : "Add New Customer"}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {(["customer", "ratesheet", ...(isEditMode ? ["settings"] : [])] as Tab[]).map((tab) => {
              const labels: Record<Tab, { icon: React.ReactNode; text: string }> = {
                customer: { icon: <User className="h-4 w-4" />, text: "Customer Info" },
                ratesheet: {
                  icon: <DollarSign className="h-4 w-4" />,
                  text: "Rate Sheet" + (!isEditMode && enableRateSheet ? "" : ""),
                },
                settings: { icon: <Settings className="h-4 w-4" />, text: "Settings" },
              };
              const { icon, text } = labels[tab];
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
                    activeTab === tab
                      ? "bg-white text-primary border-border"
                      : "bg-muted/40 text-muted-foreground border-transparent hover:text-foreground"
                  }`}
                >
                  {icon}
                  {text}
                  {tab === "ratesheet" && !isEditMode && enableRateSheet && (
                    <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full">ON</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Body ── */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          {/* ════ CUSTOMER INFO TAB ════ */}
          {activeTab === "customer" && (
            <>
              {/* Basic Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer Name <span className="text-red-500">*</span>
                    </label>
                    <Input ref={firstInputRef} type="text" name="name" value={formData.name}
                      onChange={handleChange} required placeholder="Enter customer name" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <Input type="email" name="email" value={formData.email}
                      onChange={handleChange} placeholder="customer@example.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                    <Input type="text" name="contactName" value={formData.contactName}
                      onChange={handleChange} placeholder="Primary contact person" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <Input type="tel" name="phone" value={formData.phone}
                      onChange={handleChange} required maxLength={20} placeholder="+91 98765 43210" />
                  </div>
                </div>
              </div>

              {/* GST Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">GST Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      GSTIN <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <Input type="text" name="gstin" value={formData.gstin} onChange={handleChange}
                        required maxLength={15} placeholder="22AAAAA0000A1Z5" className="flex-1 uppercase" />
                      <GstinVerifyButton gstin={formData.gstin} onVerified={handleGstinVerified} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Format: 27ABCDE1234F1Z5</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State Code <span className="text-red-500">*</span>
                    </label>
                    <Input type="text" name="stateCode" value={formData.stateCode}
                      onChange={handleChange} required maxLength={2} placeholder="27"
                      readOnly={gstAutoFilled} className={gstAutoFilled ? "bg-gray-100" : ""} />
                    <p className="text-xs text-gray-500 mt-1">
                      {gstAutoFilled ? "Auto-filled from GSTIN" : "2 characters"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PAN</label>
                    <Input type="text"
                      value={formData.gstin.length >= 12 ? formData.gstin.substring(2, 12) : ""}
                      readOnly placeholder="Auto-filled from GSTIN" className="bg-gray-100 uppercase" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State <span className="text-red-500">*</span>
                    </label>
                    <Input type="text" name="state" value={formData.state} onChange={handleChange}
                      required placeholder="Maharashtra"
                      readOnly={gstAutoFilled} className={gstAutoFilled ? "bg-gray-100" : ""} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City <span className="text-red-500">*</span>
                    </label>
                    <Input type="text" name="city" value={formData.city}
                      onChange={handleChange} required placeholder="Mumbai" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pincode <span className="text-red-500">*</span>
                    </label>
                    <Input type="text" name="pincode" value={formData.pincode}
                      onChange={handleChange} required maxLength={6} placeholder="400001" />
                  </div>
                </div>
              </div>

              {/* Billing Address */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Billing Address</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address Line 1 <span className="text-red-500">*</span>
                    </label>
                    <Input type="text" name="addressLine1" value={formData.addressLine1}
                      onChange={handleChange} required placeholder="Street address, building name" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                    <Input type="text" name="addressLine2" value={formData.addressLine2}
                      onChange={handleChange} placeholder="Apartment, suite, floor (optional)" />
                  </div>
                </div>
              </div>

              {/* Shipping Addresses */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Shipping Addresses</h3>
                  {!isEditMode && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Switch checked={sameAsBilling} onCheckedChange={handleSameAsBillingChange} />
                      <span className="text-sm text-foreground">Same as billing</span>
                    </label>
                  )}
                </div>
                <div className="space-y-3">
                  {shippingAddresses.map((addr, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
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
                            <button type="button" onClick={() => updateAddress(idx, "isDefault", true)}
                              className="text-xs text-primary hover:text-primary/80 font-medium">
                              Set Default
                            </button>
                          )}
                          {shippingAddresses.length > 1 && (
                            <button type="button" onClick={() => removeAddress(idx)}
                              className="text-gray-400 hover:text-red-500">
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
                          <Input value={addr.label}
                            onChange={(e) => updateAddress(idx, "label", e.target.value)}
                            placeholder="e.g. Warehouse"
                            disabled={!isEditMode && sameAsBilling}
                            className={!isEditMode && sameAsBilling ? "bg-gray-100" : ""} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            GSTIN (for autofill)
                          </label>
                          <div className="flex gap-2">
                            <Input value={addr.gstin}
                              onChange={(e) => updateAddress(idx, "gstin", e.target.value.toUpperCase())}
                              placeholder="22AAAAA0000A1Z5" maxLength={15}
                              disabled={!isEditMode && sameAsBilling}
                              className={`flex-1 uppercase ${!isEditMode && sameAsBilling ? "bg-gray-100" : ""}`} />
                            <GstinVerifyButton gstin={addr.gstin}
                              onVerified={(r) => handleShippingGstinVerified(idx, r)}
                              disabled={!isEditMode && sameAsBilling} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Address <span className="text-red-500">*</span>
                          </label>
                          <Input value={addr.address}
                            onChange={(e) => updateAddress(idx, "address", e.target.value)}
                            placeholder="Street / Building"
                            disabled={!isEditMode && sameAsBilling}
                            className={!isEditMode && sameAsBilling ? "bg-gray-100" : ""} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                          <Input value={addr.city}
                            onChange={(e) => updateAddress(idx, "city", e.target.value)}
                            placeholder="City"
                            disabled={!isEditMode && sameAsBilling}
                            className={!isEditMode && sameAsBilling ? "bg-gray-100" : ""} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                          <Input value={addr.state}
                            onChange={(e) => updateAddress(idx, "state", e.target.value)}
                            placeholder="State"
                            disabled={!isEditMode && sameAsBilling}
                            className={!isEditMode && sameAsBilling ? "bg-gray-100" : ""} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Pincode</label>
                          <Input value={addr.pincode}
                            onChange={(e) => updateAddress(idx, "pincode", e.target.value)}
                            placeholder="Pincode"
                            disabled={!isEditMode && sameAsBilling}
                            className={!isEditMode && sameAsBilling ? "bg-gray-100" : ""} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Contact Name</label>
                          <Input value={addr.contactName}
                            onChange={(e) => updateAddress(idx, "contactName", e.target.value)}
                            placeholder="Contact person"
                            disabled={!isEditMode && sameAsBilling}
                            className={!isEditMode && sameAsBilling ? "bg-gray-100" : ""} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Contact Phone</label>
                          <Input type="tel" value={addr.contactPhone}
                            onChange={(e) => updateAddress(idx, "contactPhone", e.target.value)}
                            placeholder="+91 98765 43210" maxLength={20}
                            disabled={!isEditMode && sameAsBilling}
                            className={!isEditMode && sameAsBilling ? "bg-gray-100" : ""} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!isEditMode ? !sameAsBilling : true) && (
                    <button type="button" onClick={addAddress}
                      className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium py-1">
                      <Plus className="h-4 w-4" />
                      Add Another Address
                    </button>
                  )}
                </div>
              </div>

              {/* Financial Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Financial Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance</label>
                    <Input type="number" name="openingBalance" value={formData.openingBalance}
                      onChange={handleChange} step="0.01" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Opening As Of Date <span className="text-red-500">*</span>
                    </label>
                    <Input type="date" name="openingAsOfDate" value={formData.openingAsOfDate}
                      onChange={handleChange} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Credit Days</label>
                    <Input type="number" name="creditDays" value={formData.creditDays}
                      onChange={handleChange} min="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit</label>
                    <Input type="number" name="creditLimit" value={formData.creditLimit}
                      onChange={handleChange} step="0.01" min="0" />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ════ RATE SHEET TAB ════ */}
          {activeTab === "ratesheet" && (
            <>
              {isEditMode ? (
                /* Edit mode: list existing rate sheets */
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {existingRateSheets.length} rate sheet{existingRateSheets.length !== 1 ? "s" : ""} linked to this customer
                    </p>
                    {!showRSEditor && (
                      <Button type="button" size="sm" variant="outline" onClick={openNewRS}>
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        Add Rate Sheet
                      </Button>
                    )}
                  </div>

                  {showRSEditor ? (
                    <div className="border border-border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800">
                          {editingRSId ? "Edit Rate Sheet" : "New Rate Sheet"}
                        </p>
                        <button type="button" onClick={() => { setShowRSEditor(false); setEditingRSId(null); }}
                          className="text-gray-400 hover:text-gray-600">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <RateSheetEditor value={rsEditorData} onChange={setRSEditorData} compact />
                      <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button type="button" variant="outline" size="sm"
                          onClick={() => { setShowRSEditor(false); setEditingRSId(null); }}>
                          Cancel
                        </Button>
                        <Button type="button" size="sm" disabled={savingRS}
                          className="bg-teal-500 hover:bg-teal-600" onClick={handleSaveRS}>
                          {savingRS ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                          Save Rate Sheet
                        </Button>
                      </div>
                    </div>
                  ) : existingRateSheets.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No rate sheets yet</p>
                      <p className="text-xs mt-1">Click &ldquo;Add Rate Sheet&rdquo; to create one</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {existingRateSheets.map((rs) => {
                        const status = getRSStatus(rs);
                        return (
                          <div key={rs.id} className="border border-border rounded-lg p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-medium text-gray-900 truncate">{rs.name}</p>
                                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${status.color}`}>
                                    {status.label}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {fmtDate(rs.validFrom)} — {rs.validTo ? fmtDate(rs.validTo) : "No end date"}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button type="button" onClick={() => openEditRS(rs)}
                                  className="p-1.5 text-gray-400 hover:text-teal-600 rounded">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button type="button" onClick={() => handleDeleteRS(rs.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                /* Create mode: enable toggle */
                <>
                  <div className="flex items-center justify-between p-4 bg-muted/30 border border-border rounded-lg">
                    <div>
                      <p className="font-medium text-foreground">Enable Rate Sheet</p>
                      <p className="text-sm text-muted-foreground">
                        Create a rate sheet with custom discounts for this customer
                      </p>
                    </div>
                    <Switch checked={enableRateSheet} onCheckedChange={setEnableRateSheet} />
                  </div>
                  {enableRateSheet ? (
                    <RateSheetEditor value={rateSheetData} onChange={setRateSheetData} compact />
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Enable the toggle above to configure a rate sheet</p>
                      <p className="text-xs mt-1">You can also add rate sheets later</p>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ════ SETTINGS TAB (edit mode only) ════ */}
          {activeTab === "settings" && isEditMode && (
            <>
              {/* Portal Settings */}
              <div className="border border-border rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-gray-900">Portal Access (PIN)</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Set a 6-digit PIN to give this customer access to the B2B portal. Leave empty to remove access.
                </p>
                <div className="flex items-center gap-3">
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={portalPin}
                    onChange={(e) => setPortalPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit PIN"
                    className="max-w-[160px] font-mono tracking-widest"
                  />
                  <Button type="button" size="sm" variant="outline"
                    onClick={handleSavePortal} disabled={savingPortal}>
                    {savingPortal
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : portalMsg === "Saved" ? <Check className="h-4 w-4 text-green-600" /> : "Save PIN"}
                  </Button>
                  {portalMsg && portalMsg !== "Saved" && (
                    <span className="text-xs text-red-600">{portalMsg}</span>
                  )}
                  {portalMsg === "Saved" && (
                    <span className="text-xs text-green-600">Saved</span>
                  )}
                </div>
              </div>

              {/* Preferred Brands */}
              <div className="border border-border rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-gray-900">Preferred Brands</h3>
                  </div>
                  <Button type="button" size="sm" variant="outline"
                    onClick={handleSaveBrands} disabled={savingBrands}>
                    {savingBrands
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : brandsMsg === "Saved" ? <Check className="h-4 w-4 text-green-600" /> : "Save"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  These brands will be highlighted for this customer in the portal.
                </p>
                {allBrands.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Loading brands…</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {allBrands.map((brand) => {
                      const checked = preferredBrandIds.includes(brand.id);
                      return (
                        <label key={brand.id}
                          className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                            checked
                              ? "border-teal-300 bg-teal-50 text-teal-800"
                              : "border-gray-200 hover:border-gray-300 text-gray-700"
                          }`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setPreferredBrandIds((prev) =>
                                e.target.checked
                                  ? [...prev, brand.id]
                                  : prev.filter((id) => id !== brand.id)
                              )
                            }
                            className="rounded border-gray-300 text-teal-600"
                          />
                          {brand.name}
                        </label>
                      );
                    })}
                  </div>
                )}
                {brandsMsg && brandsMsg !== "Saved" && (
                  <p className="text-xs text-red-600 mt-2">{brandsMsg}</p>
                )}
                {brandsMsg === "Saved" && (
                  <p className="text-xs text-green-600 mt-2">Saved</p>
                )}
              </div>
            </>
          )}
        </form>

        {/* ── Footer ── */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            {isEditMode
              ? activeTab === "ratesheet"
                ? "Rate sheets are saved individually above"
                : activeTab === "settings"
                  ? "Portal and brand settings are saved individually above"
                  : "Saves customer info and shipping addresses"
              : activeTab === "customer"
                ? "Fill customer details, then switch to Rate Sheet tab if needed"
                : enableRateSheet
                  ? "Configure discounts, then create the customer"
                  : "Enable rate sheet or go back to Customer Info"}
          </p>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            {activeTab !== "settings" && (
              <Button onClick={handleSubmit} disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90 text-white">
                {isSubmitting
                  ? (isEditMode ? "Saving…" : "Creating…")
                  : (isEditMode ? "Save Changes" : "Create Customer")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
