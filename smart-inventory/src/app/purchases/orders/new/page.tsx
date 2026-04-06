"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PurchaseOrderItemRow } from "@/components/purchase-orders/PurchaseOrderItemRow";
import { VendorSelectionModal } from "@/components/purchase-orders/VendorSelectionModal";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Save,
  Search,
  X,
  Calculator,
  Copy,
} from "lucide-react";
import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { mutate } from "swr";

interface Vendor {
  id: string;
  vendorNumber: string;
  name: string;
  gstin: string | null;
  creditDays: number;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

interface Item {
  id: string;
  itemCode: string;
  name: string;
  unit: string;
  hsnCode: string | null;
  gstRate: number;
  purchasePrice: number;
  brandId?: string | null;
  subBrandId?: string | null;
  brand?: { id: string; name: string } | null;
  subBrand?: { id: string; name: string } | null;
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

const generateId = () =>
  `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

function NewPurchaseOrderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const copyId = searchParams.get("copy");

  // Form state
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [roundOff, setRoundOff] = useState(0);

  // Vendor state
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorSearch, setVendorSearch] = useState("");
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isLoadingVendors, setIsLoadingVendors] = useState(false);

  // Items state
  const [items, setItems] = useState<Item[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemData[]>([
    {
      id: generateId(),
      itemId: "",
      quantity: 1,
      rate: 0,
      taxRate: 0,
      taxAmount: 0,
      amount: 0,
    },
  ]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState("Loading...");

  const fetchVendors = useCallback(async () => {
    try {
      setIsLoadingVendors(true);
      const response = await fetch("/api/vendors?limit=500&activeOnly=true");
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
      const response = await fetch("/api/items?limit=9999&activeOnly=true");
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

  const loadOrderForEdit = useCallback(
    async (id: string) => {
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
          setExpectedDelivery(
            order.expectedDelivery
              ? order.expectedDelivery.split("T")[0]
              : ""
          );
          setNotes(order.notes || "");
          setTerms(order.terms || "");
          setRoundOff(Number(order.discountAmount) || 0);

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
    },
    [router]
  );

  // Load order data for copy (pre-fills vendor + items, creates a new order)
  const loadOrderForCopy = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/purchase-orders/${id}`);
      if (response.ok) {
        const order = await response.json();
        setNotes(order.notes || "");
        setTerms(order.terms || "");
        setRoundOff(Number(order.discountAmount) || 0);

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
      console.error("Error loading order for copy:", err);
      alert("Failed to load order data");
      router.push("/purchases/orders");
    }
  }, [router]);

  // Fetch next order number for new orders
  const fetchNextOrderNumber = useCallback(async () => {
    try {
      const response = await fetch("/api/purchase-orders/next-number");
      if (response.ok) {
        const data = await response.json();
        setOrderNumber(data.orderNumber);
      }
    } catch (err) {
      console.error("Error fetching next order number:", err);
    }
  }, []);

  // Fetch vendors and items
  useEffect(() => {
    fetchVendors();
    fetchItems();
  }, [fetchVendors, fetchItems]);

  // Load order for editing/copying OR fetch next order number for new order
  useEffect(() => {
    if (editId) {
      loadOrderForEdit(editId);
    } else {
      fetchNextOrderNumber();
      if (copyId) {
        loadOrderForCopy(copyId);
      }
    }
  }, [editId, copyId, loadOrderForEdit, loadOrderForCopy, fetchNextOrderNumber]);

  // Filter vendors based on search
  const filteredVendors = useMemo(() => {
    if (!vendorSearch.trim()) return [];
    const query = vendorSearch.toLowerCase();
    return vendors
      .filter(
        (v) =>
          v.name.toLowerCase().includes(query) ||
          v.vendorNumber.toLowerCase().includes(query) ||
          (v.gstin && v.gstin.toLowerCase().includes(query))
      )
      .slice(0, 10);
  }, [vendors, vendorSearch]);

  // Get selected item IDs (for preventing duplicates)
  const selectedItemIds = useMemo(
    () => orderItems.map((item) => item.itemId).filter(Boolean),
    [orderItems]
  );

  // Handle adding new item row
  const handleAddItem = () => {
    setOrderItems((prev) => [
      ...prev,
      {
        id: generateId(),
        itemId: "",
        quantity: 1,
        rate: 0,
        taxRate: 0,
        taxAmount: 0,
        amount: 0,
      },
    ]);
  };

  // Handle updating item row
  const handleUpdateItem = (index: number, updatedItem: OrderItemData) => {
    setOrderItems((prev) => {
      const newItems = [...prev];
      newItems[index] = updatedItem;
      return newItems;
    });
  };

  // Handle removing item row
  const handleRemoveItem = (index: number) => {
    if (orderItems.length === 1) {
      // Reset instead of remove if it's the last one
      setOrderItems([
        {
          id: generateId(),
          itemId: "",
          quantity: 1,
          rate: 0,
          taxRate: 0,
          taxAmount: 0,
          amount: 0,
        },
      ]);
    } else {
      setOrderItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // Calculate totals
  const totals = useMemo(() => {
    const validItems = orderItems.filter(
      (item) => item.itemId && item.amount > 0
    );
    const subtotal = validItems.reduce((sum, item) => sum + item.amount, 0);
    const totalTax = validItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const cgst = totalTax / 2;
    const sgst = totalTax / 2;
    const totalAmount = subtotal + totalTax + roundOff;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      cgst: Math.round(cgst * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
    };
  }, [orderItems, roundOff]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Handle form submission
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

    if (expectedDelivery && new Date(expectedDelivery) < new Date(orderDate)) {
      setError("Expected delivery date cannot be before order date");
      return;
    }

    const validItems = orderItems.filter(
      (item) => item.itemId && item.quantity > 0 && item.rate > 0
    );


    if (validItems.length === 0) {
      setError("Please add at least one item with valid quantity and rate");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        vendorId: selectedVendor.id,
        date: orderDate,
        expectedDelivery: expectedDelivery || null,
        notes: notes || null,
        terms: terms || null,
        roundOff,
        items: validItems.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          rate: item.rate,
          taxRate: item.taxRate,
        })),
      };

      const url = editId
        ? `/api/purchase-orders/${editId}`
        : "/api/purchase-orders";
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

      mutate(
        (key) =>
          typeof key === "string" && key.includes("/api/purchase-orders"),
        undefined,
        { revalidate: true }
      );
      router.push("/purchases/orders");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Sticky action bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => router.push("/purchases/orders")} className="text-gray-500 -ml-2">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div className="h-4 w-px bg-gray-200" />
              <div>
                <span className="text-base font-bold text-gray-900">
                  {editId ? "Edit Purchase Order" : copyId ? "Duplicate Purchase Order" : "New Purchase Order"}
                </span>
                <span className="ml-2 text-sm text-gray-400">#{orderNumber}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => router.push("/purchases/orders")}>Cancel</Button>
              <Button size="sm" onClick={handleSubmit} disabled={isSubmitting} className="bg-teal-500 hover:bg-teal-600 text-white">
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving...</>
                ) : (
                  <><Save className="h-4 w-4 mr-1.5" />{editId ? "Update Order" : "Create Order"}</>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {copyId && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700 text-sm flex items-center gap-2">
              <Copy className="h-4 w-4 shrink-0" />
              Duplicating from an existing order — review and save to create a new order.
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {/* Row 1: Order details + Vendor */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Order Details</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Order Date <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Expected Delivery
                  </label>
                  <Input
                    type="date"
                    value={expectedDelivery}
                    onChange={(e) => setExpectedDelivery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Vendor Card */}
            <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Vendor <span className="text-red-400">*</span>
              </p>
              {isLoadingVendors ? (
                <div className="flex items-center gap-2 text-gray-500 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading vendors...</span>
                </div>
              ) : (
                  <div className="space-y-2">
                    {!selectedVendor && (
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            type="text"
                            placeholder="Search vendors by name, number, or GSTIN..."
                            value={vendorSearch}
                            onChange={(e) => setVendorSearch(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsVendorModalOpen(true)}
                          className="shrink-0"
                        >
                          Browse
                        </Button>
                      </div>
                    )}
                    {vendorSearch && !selectedVendor && (
                      <div className="border rounded-lg max-h-48 overflow-y-auto">
                        {filteredVendors.length === 0 ? (
                          <p className="p-3 text-gray-500 text-sm">
                            No vendors found
                          </p>
                        ) : (
                          filteredVendors.map((vendor) => (
                            <button
                              key={vendor.id}
                              type="button"
                              onClick={() => {
                                setSelectedVendor(vendor);
                                setVendorSearch("");
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
                            >
                              <p className="font-medium">{vendor.name}</p>
                              <p className="text-xs text-gray-500">
                                {vendor.vendorNumber}
                                {vendor.gstin && ` | GSTIN: ${vendor.gstin}`}
                                {vendor.city && ` | ${vendor.city}`}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                    {selectedVendor && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 bg-teal-50 border border-teal-200 rounded-lg">
                          <div>
                            <p className="font-medium text-teal-900">
                              {selectedVendor.name}
                            </p>
                            <p className="text-sm text-teal-700">
                              {selectedVendor.vendorNumber}
                              {selectedVendor.gstin &&
                                ` | GSTIN: ${selectedVendor.gstin}`}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedVendor(null)}
                            className="text-teal-600 hover:text-teal-800"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                        {/* Vendor Address */}
                        {(selectedVendor.address ||
                          selectedVendor.city ||
                          selectedVendor.state) && (
                          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                            <p className="text-sm font-medium text-gray-700 mb-2">
                              Vendor Address
                            </p>
                            <div className="text-sm text-gray-600">
                              {selectedVendor.address && (
                                <p>{selectedVendor.address}</p>
                              )}
                              <p>
                                {[
                                  selectedVendor.city,
                                  selectedVendor.state,
                                  selectedVendor.pincode,
                                ]
                                  .filter(Boolean)
                                  .join(", ")}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <VendorSelectionModal
                      isOpen={isVendorModalOpen}
                      onClose={() => setIsVendorModalOpen(false)}
                      vendors={vendors}
                      onSelect={(vendor) => {
                        setSelectedVendor(vendor);
                        setVendorSearch("");
                        setIsVendorModalOpen(false);
                      }}
                    />
                  </div>
                )}
            </div>
          </div>

          {/* Items Section */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Line Items</p>
            </div>
            {isLoadingItems ? (
              <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading items...</span>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">S.No</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">HSN/SAC</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">Tax %</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Qty</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">Unit</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Rate ₹</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Amount</th>
                        <th className="px-3 py-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderItems.map((item, index) => (
                        <PurchaseOrderItemRow
                          key={item.id}
                          item={item}
                          items={items}
                          selectedItemIds={selectedItemIds}
                          sno={index + 1}
                          onUpdate={(updatedItem) =>
                            handleUpdateItem(index, updatedItem)
                          }
                          onRemove={() => handleRemoveItem(index)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-gray-100">
                  <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Item
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Notes + Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Notes</p>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes about this order..." rows={3} className="resize-none" />
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Terms & Conditions</p>
                <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Terms and conditions for this order..." rows={3} className="resize-none" />
              </div>
            </div>
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="h-4 w-4 text-gray-400" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Summary</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Taxable Value</span>
                  <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">CGST</span>
                  <span>{formatCurrency(totals.cgst)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">SGST</span>
                  <span>{formatCurrency(totals.sgst)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Round Off</span>
                  <Input
                    type="number" step="0.01" min="-1" max="1"
                    value={roundOff}
                    onChange={(e) => setRoundOff(parseFloat(e.target.value) || 0)}
                    className="w-24 text-right h-8"
                  />
                </div>

                <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span className="text-teal-600">{formatCurrency(totals.totalAmount)}</span>
                </div>
              </div>
            </div>
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
