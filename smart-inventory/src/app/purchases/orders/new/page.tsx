"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Save,
  Search,
  X,
  Trash2,
} from "lucide-react";
import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { mutate } from "swr";

interface Vendor {
  id: string;
  vendorNumber: string;
  name: string;
  gstin: string | null;
  city: string | null;
  state: string | null;
}

interface Item {
  id: string;
  itemCode: string;
  name: string;
  unit: string;
  hsnCode: string | null;
  gstRate: number;
  purchasePrice: number;
}

interface OrderItemData {
  id: string;
  itemId: string;
  quantity: number;
  rate: number;
  taxRate: number;
  taxAmount: number;
  amount: number;
}

const generateId = () => `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

function NewPurchaseOrderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [notes, setNotes] = useState("");

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorSearch, setVendorSearch] = useState("");
  const [isLoadingVendors, setIsLoadingVendors] = useState(false);

  const [items, setItems] = useState<Item[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemData[]>([
    { id: generateId(), itemId: "", quantity: 1, rate: 0, taxRate: 0, taxAmount: 0, amount: 0 },
  ]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState("(Auto-generated)");

  const fetchVendors = useCallback(async () => {
    try {
      setIsLoadingVendors(true);
      const response = await fetch("/api/vendors?limit=500");
      if (response.ok) {
        const data = await response.json();
        setVendors(data.vendors || []);
      }
    } catch (err) {
      console.error("Error fetching vendors:", err);
    } finally {
      setIsLoadingVendors(false);
    }
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      setIsLoadingItems(true);
      const response = await fetch("/api/items?limit=1000&activeOnly=true");
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Error fetching items:", err);
    } finally {
      setIsLoadingItems(false);
    }
  }, []);

  const loadOrderForEdit = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/purchase-orders/${id}`);
      if (response.ok) {
        const order = await response.json();

        if (order.status !== "OPEN") {
          alert("Only orders with OPEN status can be edited");
          router.push("/purchases/orders");
          return;
        }

        setOrderNumber(order.orderNumber);
        setOrderDate(order.date.split("T")[0]);
        setExpectedDelivery(order.expectedDelivery ? order.expectedDelivery.split("T")[0] : "");
        setNotes(order.notes || "");

        if (order.vendor) {
          setSelectedVendor(order.vendor);
        }

        if (order.items && order.items.length > 0) {
          interface ApiOrderItem {
            id: string;
            itemId: string;
            quantity: number;
            rate: number;
            taxRate: number;
            taxAmount: number;
            amount: number;
          }
          setOrderItems(
            order.items.map((item: ApiOrderItem) => ({
              id: item.id,
              itemId: item.itemId,
              quantity: Number(item.quantity),
              rate: Number(item.rate),
              taxRate: Number(item.taxRate),
              taxAmount: Number(item.taxAmount),
              amount: Number(item.amount),
            }))
          );
        }
      }
    } catch (err) {
      console.error("Error loading order:", err);
      alert("Failed to load order for editing");
      router.push("/purchases/orders");
    }
  }, [router]);

  useEffect(() => {
    fetchVendors();
    fetchItems();
    if (editId) {
      loadOrderForEdit(editId);
    }
  }, [fetchVendors, fetchItems, editId, loadOrderForEdit]);

  const filteredVendors = useMemo(() => {
    if (!vendorSearch) return vendors;
    const search = vendorSearch.toLowerCase();
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(search) ||
        v.vendorNumber.toLowerCase().includes(search) ||
        (v.gstin && v.gstin.toLowerCase().includes(search))
    );
  }, [vendors, vendorSearch]);

  const calculateLineItem = useCallback((quantity: number, rate: number, taxRate: number) => {
    const amount = quantity * rate;
    const taxAmount = amount * (taxRate / 100);
    return {
      amount: Math.round(amount * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
    };
  }, []);

  const handleItemChange = useCallback(
    (index: number, field: string, value: string | number) => {
      setOrderItems((prev) => {
        const updated = [...prev];
        const item = { ...updated[index] };

        if (field === "itemId") {
          item.itemId = value as string;
          const selectedItem = items.find((i) => i.id === value);
          if (selectedItem) {
            item.rate = Number(selectedItem.purchasePrice) || 0;
            item.taxRate = Number(selectedItem.gstRate) || 0;
          }
        } else if (field === "quantity") {
          item.quantity = Number(value) || 0;
        } else if (field === "rate") {
          item.rate = Number(value) || 0;
        } else if (field === "taxRate") {
          item.taxRate = Number(value) || 0;
        }

        const calculated = calculateLineItem(item.quantity, item.rate, item.taxRate);
        item.amount = calculated.amount;
        item.taxAmount = calculated.taxAmount;

        updated[index] = item;
        return updated;
      });
    },
    [items, calculateLineItem]
  );

  const handleAddItem = () => {
    setOrderItems((prev) => [
      ...prev,
      { id: generateId(), itemId: "", quantity: 1, rate: 0, taxRate: 0, taxAmount: 0, amount: 0 },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (orderItems.length > 1) {
      setOrderItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const totals = useMemo(() => {
    const subtotal = orderItems.reduce((sum, item) => sum + item.amount, 0);
    const totalTax = orderItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const totalAmount = subtotal + totalTax;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
    };
  }, [orderItems]);

  const handleSubmit = async () => {
    setError(null);

    if (!selectedVendor) {
      setError("Please select a vendor");
      return;
    }

    if (!orderDate) {
      setError("Please select an order date");
      return;
    }

    const validItems = orderItems.filter((item) => item.itemId && item.quantity > 0);
    if (validItems.length === 0) {
      setError("Please add at least one item with quantity");
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        vendorId: selectedVendor.id,
        date: orderDate,
        expectedDelivery: expectedDelivery || null,
        notes: notes || null,
        items: validItems.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          rate: item.rate,
          taxRate: item.taxRate,
        })),
      };

      const url = editId ? `/api/purchase-orders/${editId}` : "/api/purchase-orders";
      const method = editId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save order");
      }

      mutate((key: string) => key.startsWith("/api/purchase-orders"));
      router.push("/purchases/orders");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const usedItemIds = useMemo(() => new Set(orderItems.map((item) => item.itemId).filter(Boolean)), [orderItems]);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/purchases/orders")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </Button>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {editId ? `Edit Purchase Order - ${orderNumber}` : "New Purchase Order"}
          </h1>
          <p className="text-gray-600">
            {editId ? "Update purchase order details" : "Create a new purchase order for a vendor"}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Order Details */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Order Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order Number</label>
                <Input value={orderNumber} disabled className="bg-gray-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order Date *</label>
                <Input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery</label>
                <Input
                  type="date"
                  value={expectedDelivery}
                  onChange={(e) => setExpectedDelivery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Vendor Selection */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Vendor *</h2>
            {selectedVendor ? (
              <div className="flex items-center justify-between p-4 bg-teal-50 border border-teal-200 rounded-lg">
                <div>
                  <p className="font-medium">{selectedVendor.name}</p>
                  <p className="text-sm text-gray-600">
                    {selectedVendor.vendorNumber}
                    {selectedVendor.gstin && ` | GSTIN: ${selectedVendor.gstin}`}
                  </p>
                  {selectedVendor.city && (
                    <p className="text-sm text-gray-500">
                      {selectedVendor.city}, {selectedVendor.state}
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedVendor(null)}>
                  <X className="h-4 w-4 mr-2" />
                  Change
                </Button>
              </div>
            ) : (
              <div>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search vendors by name, number, or GSTIN..."
                    value={vendorSearch}
                    onChange={(e) => setVendorSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  {isLoadingVendors ? (
                    <div className="flex items-center justify-center py-8 text-gray-500">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Loading vendors...
                    </div>
                  ) : filteredVendors.length === 0 ? (
                    <div className="py-8 text-center text-gray-500">
                      {vendorSearch ? "No vendors found" : "No vendors available"}
                    </div>
                  ) : (
                    filteredVendors.map((vendor) => (
                      <button
                        key={vendor.id}
                        onClick={() => setSelectedVendor(vendor)}
                        className="w-full p-3 text-left hover:bg-gray-50 border-b last:border-b-0"
                      >
                        <p className="font-medium">{vendor.name}</p>
                        <p className="text-sm text-gray-500">
                          {vendor.vendorNumber}
                          {vendor.gstin && ` | ${vendor.gstin}`}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Order Items */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Order Items *</h2>
              <Button variant="outline" size="sm" onClick={handleAddItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 text-sm font-medium text-gray-600 w-12">#</th>
                    <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">Item</th>
                    <th className="text-left py-2 px-2 text-sm font-medium text-gray-600 w-20">HSN</th>
                    <th className="text-right py-2 px-2 text-sm font-medium text-gray-600 w-24">Qty</th>
                    <th className="text-right py-2 px-2 text-sm font-medium text-gray-600 w-28">Rate</th>
                    <th className="text-right py-2 px-2 text-sm font-medium text-gray-600 w-20">Tax %</th>
                    <th className="text-right py-2 px-2 text-sm font-medium text-gray-600 w-28">Amount</th>
                    <th className="text-center py-2 px-2 text-sm font-medium text-gray-600 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map((orderItem, index) => {
                    const selectedItem = items.find((i) => i.id === orderItem.itemId);
                    const availableItems = items.filter(
                      (i) => !usedItemIds.has(i.id) || i.id === orderItem.itemId
                    );

                    return (
                      <tr key={orderItem.id} className="border-b last:border-b-0">
                        <td className="py-2 px-2 text-sm text-gray-500">{index + 1}</td>
                        <td className="py-2 px-2">
                          <select
                            value={orderItem.itemId}
                            onChange={(e) => handleItemChange(index, "itemId", e.target.value)}
                            className="w-full border rounded px-2 py-1.5 text-sm"
                          >
                            <option value="">Select item...</option>
                            {availableItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.itemCode} - {item.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2 text-sm text-gray-500">
                          {selectedItem?.hsnCode || "-"}
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.001"
                            value={orderItem.quantity || ""}
                            onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                            className="w-full text-right"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={orderItem.rate || ""}
                            onChange={(e) => handleItemChange(index, "rate", e.target.value)}
                            className="w-full text-right"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={orderItem.taxRate || ""}
                            onChange={(e) => handleItemChange(index, "taxRate", e.target.value)}
                            className="w-full text-right"
                          />
                        </td>
                        <td className="py-2 px-2 text-right text-sm font-medium">
                          {(orderItem.amount + orderItem.taxAmount).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {orderItems.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(index)}
                              className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex justify-end">
              <div className="w-72 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax:</span>
                  <span className="font-medium">{totals.totalTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>{totals.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Notes</h2>
            <Textarea
              placeholder="Add any notes or special instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            <Button variant="outline" onClick={() => router.push("/purchases/orders")}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-teal-500 hover:bg-teal-600 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {editId ? "Update Order" : "Create Order"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function NewPurchaseOrderPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="p-6 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
          </div>
        </DashboardLayout>
      }
    >
      <NewPurchaseOrderPageContent />
    </Suspense>
  );
}
