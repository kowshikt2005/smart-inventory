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
  Trash2,
  Package,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import useSWR from "swr";

interface Item {
  id: string;
  itemCode: string;
  name: string;
  description: string | null;
  standardPrice: string | number;
  purchasePrice: string | number;
  unit: string;
  hsnCode: string | null;
  gstRate: string | number;
  minStock: number;
  isActive: boolean;
  brand?: { id: string; name: string } | null;
  subBrand?: { id: string; name: string } | null;
  inventory?: {
    physicalStock: string | number;
    openingStock: string | number;
    reservedQuantity: string | number;
    minStockLevel: string | number;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export default function ItemDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Item>>({});

  const { data: item, error, isLoading, mutate } = useSWR<Item>(`/api/items/${id}`);

  useEffect(() => {
    if (item) {
      setFormData(item);
    }
  }, [item]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          standardPrice: Number(formData.standardPrice),
          purchasePrice: Number(formData.purchasePrice),
          gstRate: Number(formData.gstRate),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update item");
      }

      await mutate();
      setIsEditing(false);
    } catch (err) {
      console.error("Error updating item:", err);
      alert(err instanceof Error ? err.message : "Failed to update item");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      const response = await fetch(`/api/items/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete item");
      }

      router.push("/masters/items");
    } catch (err) {
      console.error("Error deleting item:", err);
      alert(err instanceof Error ? err.message : "Failed to delete item");
    }
  };

  const handleCancel = () => {
    setFormData(item || {});
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

  if (error || !item) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error?.message || "Item not found"}
          </div>
          <Button
            onClick={() => router.push("/masters/items")}
            variant="outline"
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Items
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const physicalStock = Number(item.inventory?.physicalStock || 0);
  const reservedQty = Number(item.inventory?.reservedQuantity || 0);
  const availableStock = physicalStock - reservedQty;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/masters/items")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Items
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{item.name}</h1>
              <p className="text-gray-600 font-mono">{item.itemCode}</p>
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

        {/* Item Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <Label>Item Code</Label>
                {isEditing ? (
                  <Input value={formData.itemCode || ""} onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })} />
                ) : (
                  <p className="mt-1 font-mono font-medium">{item.itemCode}</p>
                )}
              </div>
              <div>
                <Label>Name</Label>
                {isEditing ? (
                  <Input value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                ) : (
                  <p className="mt-1 font-medium">{item.name}</p>
                )}
              </div>
              <div>
                <Label>Description</Label>
                {isEditing ? (
                  <Input value={formData.description || ""} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                ) : (
                  <p className="mt-1">{item.description || "-"}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Brand</Label>
                  <p className="mt-1">{item.brand?.name || "-"}</p>
                </div>
                <div>
                  <Label>Sub-brand</Label>
                  <p className="mt-1">{item.subBrand?.name || "-"}</p>
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <p className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                    {item.isActive ? "Active" : "Inactive"}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Pricing & Tax */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Pricing & Tax</h2>
            <div className="space-y-4">
              <div>
                <Label>Sales Price</Label>
                {isEditing ? (
                  <Input type="number" step="0.01" value={formData.standardPrice || ""} onChange={(e) => setFormData({ ...formData, standardPrice: e.target.value })} />
                ) : (
                  <p className="mt-1 font-medium">₹{Number(item.standardPrice).toFixed(2)}</p>
                )}
              </div>
              <div>
                <Label>Purchase Price (MRP)</Label>
                {isEditing ? (
                  <Input type="number" step="0.01" value={formData.purchasePrice || ""} onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })} />
                ) : (
                  <p className="mt-1 font-medium">₹{Number(item.purchasePrice).toFixed(2)}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>HSN Code</Label>
                  {isEditing ? (
                    <Input value={formData.hsnCode || ""} onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })} />
                  ) : (
                    <p className="mt-1 font-mono">{item.hsnCode || "-"}</p>
                  )}
                </div>
                <div>
                  <Label>GST Rate</Label>
                  {isEditing ? (
                    <Input type="number" step="0.01" value={formData.gstRate || ""} onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })} />
                  ) : (
                    <p className="mt-1 font-medium">{Number(item.gstRate)}%</p>
                  )}
                </div>
              </div>
              <div>
                <Label>Unit of Measure</Label>
                {isEditing ? (
                  <Input value={formData.unit || ""} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} />
                ) : (
                  <p className="mt-1">{item.unit}</p>
                )}
              </div>
            </div>
          </div>

          {/* Inventory */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5" />
              Inventory
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 mb-1">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Opening Stock</p>
                  <p className="text-xl font-bold text-blue-600">{Number(item.inventory?.openingStock || 0)}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Physical Stock</p>
                  <p className="text-xl font-bold text-gray-900">{physicalStock}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-gray-600">Reserved</p>
                  <p className="text-xl font-bold text-yellow-600">{reservedQty}</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Available</p>
                  <p className="text-xl font-bold text-green-600">{availableStock}</p>
                </div>
              </div>
              <div>
                <Label>Minimum Stock Level</Label>
                {isEditing ? (
                  <Input type="number" value={formData.minStock || 0} onChange={(e) => setFormData({ ...formData, minStock: parseInt(e.target.value) || 0 })} />
                ) : (
                  <p className="mt-1">{item.minStock} {item.unit}</p>
                )}
              </div>
              {physicalStock <= item.minStock && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  ⚠️ Stock is at or below minimum level
                </div>
              )}
            </div>
          </div>

          {/* Additional Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Additional Information</h2>
            <div className="space-y-4">
              <div>
                <Label>Created</Label>
                <p className="mt-1 text-sm text-gray-600">{formatDate(item.createdAt)}</p>
              </div>
              <div>
                <Label>Last Updated</Label>
                <p className="mt-1 text-sm text-gray-600">{formatDate(item.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
