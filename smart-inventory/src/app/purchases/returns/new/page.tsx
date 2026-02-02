"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Plus, Save, Search, X, Trash2 } from "lucide-react";
import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { mutate } from "swr";

interface Vendor {
  id: string;
  vendorNumber: string;
  name: string;
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

interface ReturnItemData {
  id: string;
  itemId: string;
  quantity: number;
  rate: number;
  taxRate: number;
  taxAmount: number;
  amount: number;
}

const generateId = () => `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

function NewPurchaseReturnPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const purchaseInvoiceId = searchParams.get("purchaseInvoiceId");

  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorSearch, setVendorSearch] = useState("");
  const [isLoadingVendors, setIsLoadingVendors] = useState(false);

  const [items, setItems] = useState<Item[]>([]);
  const [returnItems, setReturnItems] = useState<ReturnItemData[]>([
    { id: generateId(), itemId: "", quantity: 1, rate: 0, taxRate: 0, taxAmount: 0, amount: 0 },
  ]);
  const [_isLoadingItems, setIsLoadingItems] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnNumber, setReturnNumber] = useState("(Auto-generated)");
  const [linkedInvoiceId, setLinkedInvoiceId] = useState<string | null>(null);

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

  const loadReturnForEdit = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/purchase-returns/${id}`);
      if (response.ok) {
        const ret = await response.json();

        if (ret.status !== "OPEN") {
          alert("Only OPEN returns can be edited");
          router.push("/purchases/returns");
          return;
        }

        setReturnNumber(ret.returnNumber);
        setReturnDate(ret.date.split("T")[0]);
        setReason(ret.reason || "");
        setNotes(ret.notes || "");
        setLinkedInvoiceId(ret.purchaseInvoiceId);

        if (ret.vendor) {
          setSelectedVendor(ret.vendor);
        }

        if (ret.items && ret.items.length > 0) {
          interface ApiReturnItem {
            id: string;
            itemId: string;
            quantity: number;
            rate: number;
            taxRate: number;
            taxAmount: number;
            amount: number;
          }
          setReturnItems(
            ret.items.map((item: ApiReturnItem) => ({
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
      console.error("Error loading return:", err);
      alert("Failed to load return for editing");
      router.push("/purchases/returns");
    }
  }, [router]);

  const loadInvoice = useCallback(async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/purchase-invoices/${invoiceId}`);
      if (response.ok) {
        const invoice = await response.json();
        setSelectedVendor(invoice.vendor);
        setLinkedInvoiceId(invoiceId);

        // Load items from invoice
        if (invoice.items && invoice.items.length > 0) {
          interface InvoiceItem {
            itemId: string;
            quantity: number;
            rate: number;
            taxRate: number;
            taxAmount: number;
            amount: number;
          }
          setReturnItems(
            invoice.items.map((item: InvoiceItem) => ({
              id: generateId(),
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
      console.error("Error loading invoice:", err);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
    fetchItems();
    if (editId) {
      loadReturnForEdit(editId);
    } else if (purchaseInvoiceId) {
      loadInvoice(purchaseInvoiceId);
    }
  }, [fetchVendors, fetchItems, editId, loadReturnForEdit, purchaseInvoiceId, loadInvoice]);

  const filteredVendors = useMemo(() => {
    if (!vendorSearch) return vendors;
    const search = vendorSearch.toLowerCase();
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(search) ||
        v.vendorNumber.toLowerCase().includes(search)
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
      setReturnItems((prev) => {
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
    setReturnItems((prev) => [
      ...prev,
      { id: generateId(), itemId: "", quantity: 1, rate: 0, taxRate: 0, taxAmount: 0, amount: 0 },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (returnItems.length > 1) {
      setReturnItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const totals = useMemo(() => {
    const subtotal = returnItems.reduce((sum, item) => sum + item.amount, 0);
    const totalTax = returnItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const totalAmount = subtotal + totalTax;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
    };
  }, [returnItems]);

  const handleSubmit = async () => {
    setError(null);

    if (!selectedVendor) {
      setError("Please select a vendor");
      return;
    }

    if (!returnDate) {
      setError("Please select a return date");
      return;
    }

    const validItems = returnItems.filter((item) => item.itemId && item.quantity > 0);
    if (validItems.length === 0) {
      setError("Please add at least one item with quantity");
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        vendorId: selectedVendor.id,
        purchaseInvoiceId: linkedInvoiceId || null,
        date: returnDate,
        reason: reason || null,
        notes: notes || null,
        items: validItems.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          rate: item.rate,
          taxRate: item.taxRate,
        })),
      };

      const url = editId ? `/api/purchase-returns/${editId}` : "/api/purchase-returns";
      const method = editId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save return");
      }

      mutate((key: string) => key.startsWith("/api/purchase-returns"));
      router.push("/purchases/returns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save return");
    } finally {
      setIsSubmitting(false);
    }
  };

  const usedItemIds = useMemo(() => new Set(returnItems.map((item) => item.itemId).filter(Boolean)), [returnItems]);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/purchases/returns")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Returns
          </Button>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {editId ? `Edit Purchase Return - ${returnNumber}` : "New Purchase Return"}
          </h1>
          <p className="text-gray-600">
            {editId ? "Update purchase return details" : "Create a new return to vendor"}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
        )}

        <div className="space-y-6">
          {/* Return Details */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Return Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Return Number</label>
                <Input value={returnNumber} disabled className="bg-gray-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Return Date *</label>
                <Input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
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
                  <p className="text-sm text-gray-600">{selectedVendor.vendorNumber}</p>
                </div>
                {!linkedInvoiceId && (
                  <Button variant="outline" size="sm" onClick={() => setSelectedVendor(null)}>
                    <X className="h-4 w-4 mr-2" />
                    Change
                  </Button>
                )}
              </div>
            ) : (
              <div>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search vendors..."
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
                    <div className="py-8 text-center text-gray-500">No vendors found</div>
                  ) : (
                    filteredVendors.map((vendor) => (
                      <button
                        key={vendor.id}
                        onClick={() => setSelectedVendor(vendor)}
                        className="w-full p-3 text-left hover:bg-gray-50 border-b last:border-b-0"
                      >
                        <p className="font-medium">{vendor.name}</p>
                        <p className="text-sm text-gray-500">{vendor.vendorNumber}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Return Items */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Return Items *</h2>
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
                  {returnItems.map((returnItem, index) => {
                    const selectedItem = items.find((i) => i.id === returnItem.itemId);
                    const availableItems = items.filter(
                      (i) => !usedItemIds.has(i.id) || i.id === returnItem.itemId
                    );

                    return (
                      <tr key={returnItem.id} className="border-b last:border-b-0">
                        <td className="py-2 px-2 text-sm text-gray-500">{index + 1}</td>
                        <td className="py-2 px-2">
                          <select
                            value={returnItem.itemId}
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
                        <td className="py-2 px-2 text-sm text-gray-500">{selectedItem?.hsnCode || "-"}</td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={returnItem.quantity || ""}
                            onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                            className="w-full text-right"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={returnItem.rate || ""}
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
                            value={returnItem.taxRate || ""}
                            onChange={(e) => handleItemChange(index, "taxRate", e.target.value)}
                            className="w-full text-right"
                          />
                        </td>
                        <td className="py-2 px-2 text-right text-sm font-medium">
                          {(returnItem.amount + returnItem.taxAmount).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {returnItems.length > 1 && (
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

          {/* Reason & Notes */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Reason & Notes</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Return Reason</label>
                <Textarea
                  placeholder="Why are you returning these items?"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                <Textarea
                  placeholder="Add any additional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            <Button variant="outline" onClick={() => router.push("/purchases/returns")}>
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
                  {editId ? "Update Return" : "Create Return"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function NewPurchaseReturnPage() {
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
      <NewPurchaseReturnPageContent />
    </Suspense>
  );
}
