"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Loader2,
  Edit,
  Save,
  X,
  FileText,
  Trash2,
  Plus,
  MapPin,
  Star,
  DollarSign,
  KeyRound,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import useSWR from "swr";
import { normalizeGstin, validateGstin } from "@/lib/gst-validation";
import {
  RateSheetEditor,
  emptyRateSheetFormData,
  type RateSheetFormData,
  type InclusionDiscounts,
} from "@/components/rate-sheets/RateSheetEditor";

interface ShippingAddress {
  id: string;
  customerId: string;
  label: string;
  address: string;
  city: string | null;
  state: string | null;
  pincode: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RateSheet {
  id: string;
  name: string;
  discountPercent: number;
  isActive: boolean;
  validFrom: string;
  validTo: string | null;
  useInclusionModel: boolean;
  inclusionDiscounts?: InclusionDiscounts;
  createdAt: string;
}

const emptyAddressForm = {
  label: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  isDefault: false,
};

interface Customer {
  id: string;
  customerNumber: string;
  name: string;
  contactName?: string | null;
  email: string | null;
  phone: string | null;
  gstin: string;
  stateCode: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string | null;
  creditDays: number;
  creditLimit: number;
  openingBalance: number;
  openingAsOfDate: string;
  hasPriceList: boolean;
  rateSheetId: string | null;
  rateSheet?: { id: string; name: string } | null;
  portalPassword: string | null;
  preferredBrands: { brandId: string }[];
  createdAt: string;
  updatedAt: string;
}

interface Brand {
  id: string;
  name: string;
  isActive: boolean;
}

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Customer>>({});

  // Shipping address state
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState(emptyAddressForm);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // Portal auth state
  const [portalPassword, setPortalPassword] = useState("");
  const [isSavingPortal, setIsSavingPortal] = useState(false);
  const [portalSaveMsg, setPortalSaveMsg] = useState<string | null>(null);

  // Preferred brands state
  const [preferredBrandIds, setPreferredBrandIds] = useState<string[]>([]);
  const [isSavingBrands, setIsSavingBrands] = useState(false);
  const [brandsSaveMsg, setBrandsSaveMsg] = useState<string | null>(null);

  // Rate sheet state
  const [showRateSheetForm, setShowRateSheetForm] = useState(false);
  const [editingRateSheetId, setEditingRateSheetId] = useState<string | null>(null);
  const [rateSheetForm, setRateSheetForm] = useState<RateSheetFormData>(emptyRateSheetFormData);
  const [isSavingRateSheet, setIsSavingRateSheet] = useState(false);

  const { data: customer, error, isLoading, mutate } = useSWR<Customer>(`/api/customers/${id}`);
  const { data: brandsData } = useSWR<{ brands: Brand[] }>("/api/brands?activeOnly=true");
  const { data: addressesData, mutate: mutateAddresses } = useSWR<{ addresses: ShippingAddress[] }>(
    id ? `/api/customers/${id}/shipping-addresses` : null
  );
  const shippingAddresses = addressesData?.addresses ?? [];
  const { data: rateSheetsData, mutate: mutateRateSheets } = useSWR<{ rateSheets: (RateSheet & { customers: { customer: { id: string; name: string } }[] })[] }>(
    id ? `/api/rate-sheets?customerId=${id}` : null
  );
  const rateSheets = rateSheetsData?.rateSheets ?? [];

  useEffect(() => {
    if (customer) {
      setFormData(customer);
      setPortalPassword(customer.portalPassword ?? "");
      setPreferredBrandIds(customer.preferredBrands?.map((b) => b.brandId) ?? []);
    }
  }, [customer]);

  const handleSave = async () => {
    const normalizedGstin = normalizeGstin(formData.gstin || "");
    const gstValidation = validateGstin(normalizedGstin);
    if (!gstValidation.valid) {
      alert(gstValidation.error || "Invalid GSTIN");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          gstin: normalizedGstin,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update customer");
      }

      await mutate();
      setIsEditing(false);
    } catch (err) {
      console.error("Error updating customer:", err);
      alert(err instanceof Error ? err.message : "Failed to update customer");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this customer?")) return;

    try {
      const response = await fetch(`/api/customers/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete customer");
      }

      router.push("/masters/customers");
    } catch (err) {
      console.error("Error deleting customer:", err);
      alert(err instanceof Error ? err.message : "Failed to delete customer");
    }
  };

  const handleCancel = () => {
    setFormData(customer || {});
    setIsEditing(false);
  };

  const handleSavePortal = async () => {
    // Validate: must be empty (clear) or exactly 6 digits
    if (portalPassword && !/^\d{6}$/.test(portalPassword)) {
      setPortalSaveMsg("PIN must be exactly 6 digits");
      return;
    }
    setIsSavingPortal(true);
    setPortalSaveMsg(null);
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portalPassword: portalPassword || null }),
      });
      if (!res.ok) throw new Error("Failed to save");
      await mutate();
      setPortalSaveMsg("Saved");
      setTimeout(() => setPortalSaveMsg(null), 2000);
    } catch {
      setPortalSaveMsg("Failed to save");
    } finally {
      setIsSavingPortal(false);
    }
  };

  const handleSavePreferredBrands = async () => {
    setIsSavingBrands(true);
    setBrandsSaveMsg(null);
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredBrandIds }),
      });
      if (!res.ok) throw new Error("Failed to save");
      await mutate();
      setBrandsSaveMsg("Saved");
      setTimeout(() => setBrandsSaveMsg(null), 2000);
    } catch {
      setBrandsSaveMsg("Failed to save");
    } finally {
      setIsSavingBrands(false);
    }
  };

  const openAddAddress = () => {
    setEditingAddressId(null);
    setAddressForm(emptyAddressForm);
    setShowAddressForm(true);
  };

  const openEditAddress = (addr: ShippingAddress) => {
    setEditingAddressId(addr.id);
    setAddressForm({
      label: addr.label,
      address: addr.address,
      city: addr.city || "",
      state: addr.state || "",
      pincode: addr.pincode || "",
      isDefault: addr.isDefault,
    });
    setShowAddressForm(true);
  };

  const handleSaveAddress = async () => {
    if (!addressForm.label.trim() || !addressForm.address.trim()) {
      alert("Label and address are required");
      return;
    }
    setIsSavingAddress(true);
    try {
      const url = editingAddressId
        ? `/api/customers/${id}/shipping-addresses/${editingAddressId}`
        : `/api/customers/${id}/shipping-addresses`;
      const method = editingAddressId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addressForm),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save address");
      }
      await mutateAddresses();
      setShowAddressForm(false);
      setEditingAddressId(null);
      setAddressForm(emptyAddressForm);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save address");
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm("Delete this shipping address?")) return;
    try {
      const res = await fetch(`/api/customers/${id}/shipping-addresses/${addressId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete address");
      }
      await mutateAddresses();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete address");
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    try {
      const res = await fetch(`/api/customers/${id}/shipping-addresses/${addressId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) throw new Error("Failed to set default");
      await mutateAddresses();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to set default");
    }
  };

  const openAddRateSheet = () => {
    setEditingRateSheetId(null);
    setRateSheetForm({
      ...emptyRateSheetFormData,
      name: `Rate Sheet - ${new Date().toISOString().split("T")[0]}`,
    });
    setShowRateSheetForm(true);
  };

  const openEditRateSheet = (rs: RateSheet) => {
    setEditingRateSheetId(rs.id);
    setRateSheetForm({
      name: rs.name,
      validFrom: rs.validFrom.split("T")[0],
      validTo: rs.validTo ? rs.validTo.split("T")[0] : "",
      isActive: rs.isActive,
      inclusionDiscounts: rs.inclusionDiscounts || { brands: [], subBrands: [], items: [] },
    });
    setShowRateSheetForm(true);
  };

  const handleSaveRateSheet = async () => {
    setIsSavingRateSheet(true);
    const totalInclusions =
      rateSheetForm.inclusionDiscounts.brands.length +
      rateSheetForm.inclusionDiscounts.subBrands.length +
      rateSheetForm.inclusionDiscounts.items.length;

    try {
      const url = editingRateSheetId
        ? `/api/rate-sheets/${editingRateSheetId}`
        : "/api/rate-sheets";
      const method = editingRateSheetId ? "PUT" : "POST";

      const generatedName = rateSheetForm.name?.trim() || `Rate Sheet - ${rateSheetForm.validFrom} - ${customer?.name || "Customer"}`;

      const payload: Record<string, unknown> = {
        name: generatedName,
        validFrom: rateSheetForm.validFrom,
        validTo: rateSheetForm.validTo || null,
        discountPercent: 0,
        isActive: rateSheetForm.isActive,
        useInclusionModel: totalInclusions > 0,
        inclusionDiscounts: rateSheetForm.inclusionDiscounts,
        excludedItemIds: [],
        excludedBrandIds: [],
        excludedSubBrandIds: [],
      };
      // Only send customerIds on create
      if (!editingRateSheetId) {
        payload.customerIds = [id];
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save rate sheet");
      }
      await mutateRateSheets();
      setShowRateSheetForm(false);
      setEditingRateSheetId(null);
      setRateSheetForm(emptyRateSheetFormData);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save rate sheet");
    } finally {
      setIsSavingRateSheet(false);
    }
  };

  const handleDeleteRateSheet = async (rsId: string) => {
    if (!confirm("Delete this rate sheet?")) return;
    try {
      const res = await fetch(`/api/rate-sheets/${rsId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await mutateRateSheets();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete rate sheet");
    }
  };

  const getRateSheetStatus = (rs: RateSheet) => {
    if (!rs.isActive) return { label: "Inactive", color: "bg-gray-100 text-gray-600" };
    const now = new Date();
    const from = new Date(rs.validFrom);
    const to = rs.validTo ? new Date(rs.validTo) : null;
    if (from > now) return { label: "Pending", color: "bg-yellow-100 text-yellow-700" };
    if (to && to < now) return { label: "Expired", color: "bg-red-100 text-red-700" };
    return { label: "Active", color: "bg-green-100 text-green-700" };
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !customer) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error?.message || "Customer not found"}
          </div>
          <Button
            onClick={() => router.push("/masters/customers")}
            variant="outline"
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/masters/customers")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {customer.name}
              </h1>
              <p className="text-gray-600">{customer.customerNumber}</p>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving} className="bg-teal-500 hover:bg-teal-600">
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Changes
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => router.push(`/ledger/customers?customerId=${id}`)}>
                    <FileText className="h-4 w-4 mr-2" />
                    View Transactions
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button variant="outline" onClick={handleDelete} className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Customer Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                {isEditing ? (
                  <Input value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                ) : (
                  <p className="mt-1 font-medium">{customer.name}</p>
                )}
              </div>
              <div>
                <Label>Email</Label>
                {isEditing ? (
                  <Input type="email" value={formData.email || ""} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                ) : (
                  <p className="mt-1">{customer.email || "-"}</p>
                )}
              </div>
              <div>
                <Label>Contact Name</Label>
                {isEditing ? (
                  <Input value={formData.contactName || ""} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} />
                ) : (
                  <p className="mt-1">{customer.contactName || "-"}</p>
                )}
              </div>
              <div>
                <Label>Phone</Label>
                {isEditing ? (
                  <Input value={formData.phone || ""} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                ) : (
                  <p className="mt-1">{customer.phone || "-"}</p>
                )}
              </div>
              <div>
                <Label>GSTIN</Label>
                {isEditing ? (
                  <Input value={formData.gstin || ""} onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })} maxLength={15} />
                ) : (
                  <p className="mt-1 font-mono">{customer.gstin}</p>
                )}
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Address</h2>
            <div className="space-y-4">
              <div>
                <Label>Address Line 1</Label>
                {isEditing ? (
                  <Input value={formData.addressLine1 || ""} onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })} />
                ) : (
                  <p className="mt-1">{customer.addressLine1}</p>
                )}
              </div>
              <div>
                <Label>Address Line 2</Label>
                {isEditing ? (
                  <Input value={formData.addressLine2 || ""} onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })} />
                ) : (
                  <p className="mt-1">{customer.addressLine2 || "-"}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>City</Label>
                  {isEditing ? (
                    <Input value={formData.city || ""} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                  ) : (
                    <p className="mt-1">{customer.city}</p>
                  )}
                </div>
                <div>
                  <Label>State</Label>
                  {isEditing ? (
                    <Input value={formData.state || ""} onChange={(e) => setFormData({ ...formData, state: e.target.value })} />
                  ) : (
                    <p className="mt-1">{customer.state}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Pincode</Label>
                  {isEditing ? (
                    <Input value={formData.pincode || ""} onChange={(e) => setFormData({ ...formData, pincode: e.target.value })} />
                  ) : (
                    <p className="mt-1">{customer.pincode || "-"}</p>
                  )}
                </div>
                <div>
                  <Label>State Code</Label>
                  <p className="mt-1">{customer.stateCode}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Credit Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Credit Information</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Credit Days</Label>
                  {isEditing ? (
                    <Input type="number" value={formData.creditDays || 0} onChange={(e) => setFormData({ ...formData, creditDays: parseInt(e.target.value) || 0 })} />
                  ) : (
                    <p className="mt-1 font-medium">{customer.creditDays} days</p>
                  )}
                </div>
                <div>
                  <Label>Credit Limit</Label>
                  {isEditing ? (
                    <Input type="number" value={formData.creditLimit || 0} onChange={(e) => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })} />
                  ) : (
                    <p className="mt-1 font-medium">₹{customer.creditLimit.toLocaleString("en-IN")}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Opening Balance</Label>
                  <p className="mt-1 font-medium">₹{customer.openingBalance.toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <Label>As of Date</Label>
                  <p className="mt-1">{formatDate(customer.openingAsOfDate)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Additional Information</h2>
            <div className="space-y-4">
              <div>
                <Label>Price List</Label>
                <p className="mt-1">
                  <span className={`font-medium ${customer.hasPriceList ? "text-green-600" : "text-gray-600"}`}>
                    {customer.hasPriceList ? "Yes" : "No"}
                  </span>
                  {customer.rateSheet && <span className="text-gray-500 ml-2">({customer.rateSheet.name})</span>}
                </p>
              </div>
              <div>
                <Label>Created</Label>
                <p className="mt-1 text-sm text-gray-600">{formatDate(customer.createdAt)}</p>
              </div>
              <div>
                <Label>Last Updated</Label>
                <p className="mt-1 text-sm text-gray-600">{formatDate(customer.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Rate Sheets */}
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-teal-500" />
              <h2 className="text-lg font-semibold">Rate Sheets</h2>
              <span className="text-sm text-gray-500">({rateSheets.length})</span>
            </div>
            {!showRateSheetForm && (
              <Button variant="outline" size="sm" onClick={openAddRateSheet}>
                <Plus className="h-4 w-4 mr-1" />
                Add Rate Sheet
              </Button>
            )}
          </div>

          {/* Add / Edit Form — Comprehensive Editor */}
          {showRateSheetForm && (
            <div className="mb-5 p-5 border border-teal-200 bg-teal-50/50 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-teal-800">
                  {editingRateSheetId ? "Edit Rate Sheet" : "New Rate Sheet"}
                </h3>
                <button
                  onClick={() => {
                    setShowRateSheetForm(false);
                    setEditingRateSheetId(null);
                    setRateSheetForm(emptyRateSheetFormData);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <RateSheetEditor
                value={rateSheetForm}
                onChange={setRateSheetForm}
                compact
              />
              <div className="flex gap-2 mt-4">
                <Button size="sm" onClick={handleSaveRateSheet} disabled={isSavingRateSheet} className="bg-teal-500 hover:bg-teal-600">
                  {isSavingRateSheet ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  {editingRateSheetId ? "Update" : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowRateSheetForm(false);
                    setEditingRateSheetId(null);
                    setRateSheetForm(emptyRateSheetFormData);
                  }}
                  disabled={isSavingRateSheet}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Rate Sheet List */}
          {!showRateSheetForm && rateSheets.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">
              No rate sheets assigned to this customer.
            </p>
          ) : !showRateSheetForm && (
            <div className="space-y-3">
              {rateSheets.map((rs) => {
                const status = getRateSheetStatus(rs);
                const inclusions = rs.inclusionDiscounts;
                const totalInc = inclusions
                  ? (inclusions.brands?.length || 0) + (inclusions.subBrands?.length || 0) + (inclusions.items?.length || 0)
                  : 0;
                return (
                  <div key={rs.id} className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{rs.name}</p>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>From: {formatDate(rs.validFrom)}</span>
                          {rs.validTo && <span>To: {formatDate(rs.validTo)}</span>}
                          {totalInc > 0 && (
                            <span className="text-teal-600">{totalInc} discount rules</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => openEditRateSheet(rs)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteRateSheet(rs.id)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Shipping Addresses */}
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-teal-500" />
              <h2 className="text-lg font-semibold">Shipping Addresses</h2>
              <span className="text-sm text-gray-500">({shippingAddresses.length})</span>
            </div>
            {!showAddressForm && (
              <Button variant="outline" size="sm" onClick={openAddAddress}>
                <Plus className="h-4 w-4 mr-1" />
                Add Address
              </Button>
            )}
          </div>

          {/* Add / Edit Form */}
          {showAddressForm && (
            <div className="mb-5 p-4 border border-teal-200 bg-teal-50 rounded-lg">
              <h3 className="text-sm font-semibold text-teal-800 mb-3">
                {editingAddressId ? "Edit Address" : "New Shipping Address"}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Label *</Label>
                  <Input
                    placeholder="e.g. Warehouse, Site Office"
                    value={addressForm.label}
                    onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Address *</Label>
                  <Input
                    placeholder="Street / Building"
                    value={addressForm.address}
                    onChange={(e) => setAddressForm({ ...addressForm, address: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">City</Label>
                  <Input
                    placeholder="City"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">State</Label>
                  <Input
                    placeholder="State"
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Pincode</Label>
                  <Input
                    placeholder="Pincode"
                    value={addressForm.pincode}
                    onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addressForm.isDefault}
                      onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">Set as default</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={handleSaveAddress}
                  disabled={isSavingAddress}
                  className="bg-teal-500 hover:bg-teal-600"
                >
                  {isSavingAddress ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  {editingAddressId ? "Update" : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowAddressForm(false);
                    setEditingAddressId(null);
                    setAddressForm(emptyAddressForm);
                  }}
                  disabled={isSavingAddress}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Address List */}
          {shippingAddresses.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">
              No shipping addresses added yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {shippingAddresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`relative p-4 rounded-lg border ${
                    addr.isDefault
                      ? "border-teal-300 bg-teal-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  {addr.isDefault && (
                    <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-xs font-medium text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">
                      <Star className="h-3 w-3" />
                      Default
                    </span>
                  )}
                  <p className="text-sm font-semibold text-gray-900 pr-16">{addr.label}</p>
                  <p className="text-sm text-gray-600 mt-1">{addr.address}</p>
                  {(addr.city || addr.state || addr.pincode) && (
                    <p className="text-sm text-gray-500">
                      {[addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-3">
                    {!addr.isDefault && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-teal-600 hover:text-teal-700"
                        onClick={() => handleSetDefaultAddress(addr.id)}
                      >
                        <Star className="h-3 w-3 mr-1" />
                        Set Default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => openEditAddress(addr)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
                      onClick={() => handleDeleteAddress(addr.id)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Portal Auth ─────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-border/60 shadow-sm p-6 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="h-4 w-4 text-indigo-500" />
            <h2 className="text-base font-semibold text-gray-900">Portal PIN</h2>
            {customer.portalPassword ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full">
                <ShieldCheck className="h-3 w-3" />
                Custom PIN set
              </span>
            ) : (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Using default (123456)</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Set a 6-digit PIN for <span className="font-medium text-gray-700">{customer.name}</span> to log in to the B2B portal using their phone number. Leave blank to use the default PIN (123456).
          </p>
          <div className="flex items-center gap-3 max-w-sm">
            <input
              type="text"
              value={portalPassword}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setPortalPassword(val);
              }}
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit PIN"
              className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-sm tracking-[0.15em] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
            <Button
              size="sm"
              onClick={handleSavePortal}
              disabled={isSavingPortal || (portalPassword !== "" && !/^\d{6}$/.test(portalPassword))}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isSavingPortal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            </Button>
            {portalSaveMsg && (
              <span className={`text-xs font-medium ${portalSaveMsg === "Saved" ? "text-green-600" : "text-red-500"}`}>
                {portalSaveMsg}
              </span>
            )}
          </div>
          {portalPassword !== "" && !/^\d{6}$/.test(portalPassword) && (
            <p className="text-xs text-red-500 mt-2">PIN must be exactly 6 digits</p>
          )}
        </div>

        {/* ── Preferred Brands ───────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-border/60 shadow-sm p-6 mt-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-amber-500" />
              <h2 className="text-base font-semibold text-gray-900">Preferred Brands</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {preferredBrandIds.length === 0 ? "All brands shown" : `${preferredBrandIds.length} selected`}
              </span>
            </div>
            <Button
              size="sm"
              onClick={handleSavePreferredBrands}
              disabled={isSavingBrands}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isSavingBrands ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              {brandsSaveMsg ?? "Save"}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Select which brands this customer sees in the portal. If none selected, all active brands are shown.
          </p>
          {!brandsData ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading brands…
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {brandsData.brands.map((brand) => {
                const selected = preferredBrandIds.includes(brand.id);
                return (
                  <button
                    key={brand.id}
                    type="button"
                    onClick={() =>
                      setPreferredBrandIds((prev) =>
                        selected ? prev.filter((id) => id !== brand.id) : [...prev, brand.id]
                      )
                    }
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      selected
                        ? "border-amber-400 bg-amber-50 text-amber-800"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded flex-shrink-0 border-2 flex items-center justify-center ${selected ? "border-amber-500 bg-amber-500" : "border-gray-300"}`}>
                      {selected && <span className="w-1.5 h-1.5 bg-white rounded-sm" />}
                    </span>
                    <span className="truncate">{brand.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
