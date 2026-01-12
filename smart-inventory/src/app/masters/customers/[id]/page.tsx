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
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import useSWR from "swr";

interface Customer {
  id: string;
  customerNumber: string;
  name: string;
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
  createdAt: string;
  updatedAt: string;
}

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Customer>>({});

  const { data: customer, error, isLoading, mutate } = useSWR<Customer>(`/api/customers/${id}`);

  useEffect(() => {
    if (customer) {
      setFormData(customer);
    }
  }, [customer]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
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
                  <Input value={formData.gstin || ""} onChange={(e) => setFormData({ ...formData, gstin: e.target.value })} maxLength={15} />
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
      </div>
    </DashboardLayout>
  );
}
