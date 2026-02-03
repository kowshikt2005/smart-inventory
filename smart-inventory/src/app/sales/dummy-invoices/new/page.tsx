"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrderItemRow } from "@/components/sales-orders/OrderItemRow";
import { ArrowLeft, Plus, Loader2, Save, Search } from "lucide-react";

interface InclusionDiscount {
  id: string;
  discountPercent: number;
}

interface InclusionDiscounts {
  brands?: InclusionDiscount[];
  subBrands?: InclusionDiscount[];
  items?: InclusionDiscount[];
}

interface Customer {
  id: string;
  name: string;
  customerNumber: string;
  creditDays: number;
  rateSheet?: {
    id: string;
    isActive: boolean;
    discountPercent: number;
    useInclusionModel?: boolean;
    inclusionDiscounts?: InclusionDiscounts;
    excludedItemIds?: string[];
    excludedBrandIds?: string[];
    excludedSubBrandIds?: string[];
  } | null;
}

interface Item {
  id: string;
  itemCode: string;
  name: string;
  unit: string;
  hsnCode: string | null;
  gstRate: number;
  purchasePrice: number;
  mrp: number;
  sellingPrice: number;
  discountPercent?: number | null;
  brandId?: string | null;
  subBrandId?: string | null;
  inventory?: {
    physicalStock: number;
    reservedQuantity: number;
  } | null;
}

interface OrderItemData {
  id: string;
  itemId: string;
  quantity: number;
  rate: number;
  discountPercent: number;
  taxRate: number;
  taxAmount: number;
  amount: number;
  isGstInclusive: boolean;
}

const generateId = () => `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const blankRow = (): OrderItemData => ({
  id: generateId(),
  itemId: "",
  quantity: 1,
  rate: 0,
  discountPercent: 0,
  taxRate: 0,
  taxAmount: 0,
  amount: 0,
  isGstInclusive: false,
});

export default function NewDummyInvoicePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Customer
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);

  // Items
  const [items, setItems] = useState<Item[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItemData[]>([blankRow()]);

  // Form
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  // Customer search (debounced)
  useEffect(() => {
    if (!customerSearch.trim()) { setCustomerResults([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers?search=${encodeURIComponent(customerSearch)}&limit=10`);
        const data = await res.json();
        if (!cancelled) setCustomerResults(data.customers || []);
      } catch { /* ignore */ }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [customerSearch]);

  // Fetch all items on mount
  const fetchItems = useCallback(async () => {
    try {
      setIsLoadingItems(true);
      const res = await fetch("/api/items?limit=500&activeOnly=true&isActive=true");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Error fetching items:", err);
    } finally {
      setIsLoadingItems(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Selected item IDs for duplicate prevention in modal
  const selectedItemIds = useMemo(
    () => orderItems.map((oi) => oi.itemId).filter(Boolean),
    [orderItems]
  );

  // Resolve discount from inclusion model: Item > Sub-brand > Brand
  const resolveInclusionDiscount = useCallback(
    (itemId: string, brandId: string | null | undefined, subBrandId: string | null | undefined, inclusionDiscounts: InclusionDiscounts | undefined): number => {
      if (!inclusionDiscounts) return 0;
      if (inclusionDiscounts.items && Array.isArray(inclusionDiscounts.items)) {
        const d = inclusionDiscounts.items.find(i => i.id === itemId);
        if (d) return Number(d.discountPercent);
      }
      if (subBrandId && inclusionDiscounts.subBrands && Array.isArray(inclusionDiscounts.subBrands)) {
        const d = inclusionDiscounts.subBrands.find(sb => sb.id === subBrandId);
        if (d) return Number(d.discountPercent);
      }
      if (brandId && inclusionDiscounts.brands && Array.isArray(inclusionDiscounts.brands)) {
        const d = inclusionDiscounts.brands.find(b => b.id === brandId);
        if (d) return Number(d.discountPercent);
      }
      return 0;
    },
    []
  );

  // Pricing logic — identical to sales order:
  //   No rate sheet / discount == 0  →  selling price, EXCLUSIVE GST
  //   Rate sheet with discount > 0   →  MRP * (1 - disc%), INCLUSIVE GST
  const getEffectivePricing = useCallback(
    (item: Item, cust?: Customer | null): { rate: number; isGstInclusive: boolean; discountApplied: number } => {
      const mrp = Number(item.mrp) || Number(item.sellingPrice);
      const sellingPrice = Number(item.sellingPrice);
      const rateSheet = (cust || customer)?.rateSheet;

      if (!rateSheet || !rateSheet.isActive) {
        return { rate: sellingPrice, isGstInclusive: false, discountApplied: 0 };
      }

      const useInclusionModel = rateSheet.useInclusionModel !== false;
      let discountPercent = 0;

      if (useInclusionModel && rateSheet.inclusionDiscounts) {
        discountPercent = resolveInclusionDiscount(
          item.id, item.brandId, item.subBrandId, rateSheet.inclusionDiscounts
        );
      } else {
        const excludedItemIds = rateSheet.excludedItemIds || [];
        const excludedBrandIds = rateSheet.excludedBrandIds || [];
        const excludedSubBrandIds = rateSheet.excludedSubBrandIds || [];
        const isExcluded =
          (Array.isArray(excludedItemIds) && excludedItemIds.includes(item.id)) ||
          (item.brandId && Array.isArray(excludedBrandIds) && excludedBrandIds.includes(item.brandId)) ||
          (item.subBrandId && Array.isArray(excludedSubBrandIds) && excludedSubBrandIds.includes(item.subBrandId));
        if (!isExcluded) {
          discountPercent = Number(rateSheet.discountPercent) || 0;
        }
      }

      if (discountPercent === 0) {
        return { rate: sellingPrice, isGstInclusive: false, discountApplied: 0 };
      }

      // Discount > 0: use MRP with inclusive GST, discount already applied to rate
      const discountedRate = mrp * (1 - discountPercent / 100);
      return {
        rate: Math.round(discountedRate * 100) / 100,
        isGstInclusive: true,
        discountApplied: discountPercent,
      };
    },
    [customer, resolveInclusionDiscount]
  );

  // Compute base + tax given pricing result
  const calcAmounts = (quantity: number, rate: number, taxRate: number, isGstInclusive: boolean) => {
    if (isGstInclusive) {
      const totalInclusive = quantity * rate;
      const baseAmount = totalInclusive / (1 + taxRate / 100);
      return {
        amount: Math.round(baseAmount * 100) / 100,
        taxAmount: Math.round((totalInclusive - baseAmount) * 100) / 100,
      };
    }
    const baseAmount = quantity * rate;
    return {
      amount: Math.round(baseAmount * 100) / 100,
      taxAmount: Math.round(baseAmount * (taxRate / 100) * 100) / 100,
    };
  };

  // Customer selection — fetch full record (includes rateSheet), then reprice existing items
  const handleCustomerSelect = async (selected: Customer) => {
    let fullCustomer = selected;
    try {
      const res = await fetch(`/api/customers/${selected.id}`);
      if (res.ok) fullCustomer = await res.json();
    } catch { /* use as-is */ }

    setCustomer(fullCustomer);
    setShowCustomerDrop(false);
    setCustomerSearch("");

    // Reprice every item already in the table
    setOrderItems((prev) =>
      prev.map((oi) => {
        if (!oi.itemId) return oi;
        const item = items.find((i) => i.id === oi.itemId);
        if (!item) return oi;

        const pricing = getEffectivePricing(item, fullCustomer);
        const { amount, taxAmount } = calcAmounts(oi.quantity, pricing.rate, oi.taxRate, pricing.isGstInclusive);

        return {
          ...oi,
          rate: pricing.rate,
          discountPercent: pricing.discountApplied,
          amount,
          taxAmount,
          isGstInclusive: pricing.isGstInclusive,
        };
      })
    );
  };

  // Item picked or row edited via OrderItemRow
  const handleUpdateItem = (index: number, updatedItem: OrderItemData) => {
    const itemChanged = updatedItem.itemId && orderItems[index].itemId !== updatedItem.itemId;

    if (itemChanged) {
      const item = items.find((i) => i.id === updatedItem.itemId);
      if (item) {
        const pricing = getEffectivePricing(item);
        const taxRate = Number(item.gstRate);
        const quantity = updatedItem.quantity || 1;
        const { amount, taxAmount } = calcAmounts(quantity, pricing.rate, taxRate, pricing.isGstInclusive);

        updatedItem = {
          ...updatedItem,
          quantity,
          rate: pricing.rate,
          discountPercent: pricing.discountApplied,
          taxRate,
          amount,
          taxAmount,
          isGstInclusive: pricing.isGstInclusive,
        };
      }
    }

    setOrderItems((prev) => {
      const next = [...prev];
      next[index] = updatedItem;
      return next;
    });
  };

  const handleAddItem = () => {
    setOrderItems((prev) => [...prev, blankRow()]);
  };

  const handleRemoveItem = (index: number) => {
    if (orderItems.length === 1) {
      setOrderItems([blankRow()]);
    } else {
      setOrderItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // Totals
  const totals = useMemo(() => {
    const valid = orderItems.filter((oi) => oi.itemId && oi.amount > 0);
    const subtotal = valid.reduce((sum, oi) => sum + oi.amount, 0);
    const totalTax = valid.reduce((sum, oi) => sum + oi.taxAmount, 0);
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      cgst: Math.round((totalTax / 2) * 100) / 100,
      sgst: Math.round((totalTax / 2) * 100) / 100,
      total: Math.round((subtotal + totalTax) * 100) / 100,
    };
  }, [orderItems]);

  const dueDate = useMemo(() => {
    if (!customer || !invoiceDate) return null;
    const d = new Date(invoiceDate + "T00:00:00");
    d.setDate(d.getDate() + customer.creditDays);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }, [customer, invoiceDate]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!customer) { setError("Please select a customer"); return; }

    const validItems = orderItems.filter(
      (oi) => oi.itemId && oi.quantity > 0 && oi.rate > 0
    );
    if (validItems.length === 0) {
      setError("Please add at least one item with valid quantity and rate");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/dummy-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          invoiceDate,
          notes,
          items: validItems.map((oi) => ({
            itemId: oi.itemId,
            quantity: oi.quantity,
            rate: oi.rate,
            discountPercent: oi.discountPercent,
            taxRate: oi.taxRate,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create invoice");
        return;
      }
      const data = await res.json();
      router.push(`/sales/dummy-invoices/${data.id}`);
    } catch {
      setError("Failed to create invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/sales/dummy-invoices")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">New Dummy Invoice</h1>
              <p className="text-sm text-gray-500">Create an invoice directly without a sales order</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push("/sales/dummy-invoices")}>
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
                  Creating…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Invoice
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Invoice Details */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer <span className="text-red-500">*</span>
                </label>
                {customer ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-teal-50 border border-teal-200 rounded-lg">
                      <div>
                        <p className="font-medium text-teal-900">{customer.name}</p>
                        <p className="text-xs text-teal-700">
                          {customer.customerNumber} · {customer.creditDays} credit days
                        </p>
                        {customer.rateSheet?.isActive && (
                          <p className="text-xs text-teal-600 mt-1">
                            Rate Sheet Applied:{" "}
                            {customer.rateSheet.useInclusionModel
                              ? "Custom discounts configured"
                              : `${customer.rateSheet.discountPercent}% discount`}
                          </p>
                        )}
                      </div>
                      <button onClick={() => setCustomer(null)} className="text-teal-600 hover:text-teal-800 text-xs">
                        Change
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search customers by name or number..."
                      value={customerSearch}
                      onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDrop(true); }}
                      onFocus={() => setShowCustomerDrop(true)}
                      className="pl-10"
                    />
                    {showCustomerDrop && customerResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                        {customerResults.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => handleCustomerSelect(c)}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
                          >
                            <p className="font-medium">{c.name}</p>
                            <p className="text-xs text-gray-500">{c.customerNumber}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Invoice Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                />
                {dueDate && <p className="text-xs text-gray-500 mt-2">Due date: {dueDate}</p>}
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Items</h2>
            {isLoadingItems ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading items...</span>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">Item</th>
                        <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">HSN</th>
                        <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700">MRP</th>
                        <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700">Disc %</th>
                        <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">Qty</th>
                        <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">Unit</th>
                        <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">Rate (Incl. Tax)</th>
                        <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700">Net Rate</th>
                        <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700">GST %</th>
                        <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700">Tax Amt</th>
                        <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700">Total</th>
                        <th className="px-3 py-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderItems.map((oi, index) => (
                        <OrderItemRow
                          key={oi.id}
                          item={oi}
                          items={items}
                          selectedItemIds={selectedItemIds}
                          onUpdate={(updated) => handleUpdateItem(index, updated)}
                          onRemove={() => handleRemoveItem(index)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </>
            )}
          </div>

          {/* Notes + Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Additional notes…"
                className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">₹{fmt(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">CGST</span>
                  <span className="font-medium">₹{fmt(totals.cgst)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">SGST</span>
                  <span className="font-medium">₹{fmt(totals.sgst)}</span>
                </div>
                <hr />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>₹{fmt(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
