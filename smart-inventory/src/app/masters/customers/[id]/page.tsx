"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { AddCustomerModal } from "@/components/customers/AddCustomerModal";
import {
  ArrowLeft,
  Loader2,
  Edit,
  FileText,
  Trash2,
  MapPin,
  Star,
  DollarSign,
  KeyRound,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import useSWR from "swr";

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
  inclusionDiscounts?: {
    brands?: unknown[];
    subBrands?: unknown[];
    items?: unknown[];
  };
  createdAt: string;
}

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
  hasPortalPin: boolean;
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
  const searchParams = useSearchParams();
  const id = params.id as string;

  const [showEditModal, setShowEditModal] = useState(false);

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
  const initialEditTab = searchParams.get("tab") === "settings" ? "settings" : searchParams.get("tab") === "ratesheet" ? "ratesheet" : "customer";

  useEffect(() => {
    if (searchParams.get("mode") === "edit") {
      setShowEditModal(true);
    }
  }, [searchParams]);

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

  const preferredBrandIds = customer.preferredBrands?.map((b) => b.brandId) ?? [];
  const selectedBrands = brandsData?.brands.filter((brand) => preferredBrandIds.includes(brand.id)) ?? [];

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
              <Button variant="outline" onClick={() => router.push(`/ledger/customers?customerId=${id}`)}>
                <FileText className="h-4 w-4 mr-2" />
                View Transactions
              </Button>
              <Button variant="outline" onClick={() => setShowEditModal(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button variant="outline" onClick={handleDelete} className="text-red-600 hover:text-red-700">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
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
                <p className="text-sm font-medium text-gray-700">Name</p>
                <p className="mt-1 font-medium">{customer.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Email</p>
                <p className="mt-1">{customer.email || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Contact Name</p>
                <p className="mt-1">{customer.contactName || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Phone</p>
                <p className="mt-1">{customer.phone || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">GSTIN</p>
                <p className="mt-1 font-mono">{customer.gstin}</p>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Address</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Address Line 1</p>
                <p className="mt-1">{customer.addressLine1}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Address Line 2</p>
                <p className="mt-1">{customer.addressLine2 || "-"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">City</p>
                  <p className="mt-1">{customer.city}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">State</p>
                  <p className="mt-1">{customer.state}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Pincode</p>
                  <p className="mt-1">{customer.pincode || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">State Code</p>
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
                  <p className="text-sm font-medium text-gray-700">Credit Days</p>
                  <p className="mt-1 font-medium">{customer.creditDays} days</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Credit Limit</p>
                  <p className="mt-1 font-medium">₹{customer.creditLimit.toLocaleString("en-IN")}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Opening Balance</p>
                  <p className="mt-1 font-medium">₹{customer.openingBalance.toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">As of Date</p>
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
                <p className="text-sm font-medium text-gray-700">Price List</p>
                <p className="mt-1">
                  <span className={`font-medium ${customer.hasPriceList ? "text-green-600" : "text-gray-600"}`}>
                    {customer.hasPriceList ? "Yes" : "No"}
                  </span>
                  {customer.rateSheet && <span className="text-gray-500 ml-2">({customer.rateSheet.name})</span>}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Created</p>
                <p className="mt-1 text-sm text-gray-600">{formatDate(customer.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Last Updated</p>
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
          </div>

          {/* Rate Sheet List */}
          {rateSheets.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">
              No rate sheets assigned to this customer.
            </p>
          ) : (
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
          </div>

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
            {customer.hasPortalPin ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full">
                <ShieldCheck className="h-3 w-3" />
                Custom PIN set
              </span>
            ) : (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Using default (123456)</span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Set or update the 6-digit portal PIN for <span className="font-medium text-gray-700">{customer.name}</span> from Edit.
          </p>
        </div>

        {/* ── Preferred Brands ───────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-border/60 shadow-sm p-6 mt-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-amber-500" />
              <h2 className="text-base font-semibold text-gray-900">Preferred Brands</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {preferredBrandIds.length === 0 ? "All brands shown" : `${preferredBrandIds.length} selected`}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Brands visible in portal for this customer. Click Edit to change brand visibility.
          </p>
          {preferredBrandIds.length === 0 ? (
            <p className="text-sm text-gray-500">All brands shown</p>
          ) : !brandsData ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading brands…
            </div>
          ) : selectedBrands.length === 0 ? (
            <p className="text-sm text-gray-500">Selected brands are unavailable.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedBrands.map((brand) => (
                <span
                  key={brand.id}
                  className="inline-flex items-center px-3 py-1.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800 text-sm font-medium"
                >
                  {brand.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <AddCustomerModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            mutate();
            mutateAddresses();
            mutateRateSheets();
            setShowEditModal(false);
          }}
          editCustomer={customer}
          initialTab={initialEditTab}
        />
      </div>
    </DashboardLayout>
  );
}
