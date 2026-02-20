"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { mutate } from "swr";

interface Item {
  id: string;
  itemCode: string;
  name: string;
  unit: string;
  hsnCode: string | null;
  gstRate: number;
  sellingPrice: number;
  brandId?: string | null;
  subBrandId?: string | null;
  brand?: { id: string; name: string } | null;
  subBrand?: { id: string; name: string } | null;
}

interface InvoiceItemData {
  id: string;
  itemId: string;
  quantity: number;
  rate: number;
  taxRate: number;
  taxAmount: number;
  amount: number;
}

const generateId = () => `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

function EditSalesInvoiceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<Item[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItemData[]>([]);
  const [, setIsLoadingItems] = useState(false);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(true);

  const [filterBrandId, setFilterBrandId] = useState("");
  const [filterSubBrandId, setFilterSubBrandId] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if no edit param
  useEffect(() => {
    if (!editId) {
      router.push("/sales/invoices");
    }
  }, [editId, router]);

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

  const loadInvoice = useCallback(async (invoiceId: string) => {
    try {
      setIsLoadingInvoice(true);
      const response = await fetch(`/api/sales-invoices/${invoiceId}`);
      if (response.ok) {
        const invoice = await response.json();
        setInvoiceNumber(invoice.invoiceNumber || "");
        setCustomerName(invoice.customer?.name || "");
        setDueDate(invoice.dueDate ? new Date(invoice.dueDate).toISOString().split("T")[0] : "");
        setNotes(invoice.notes || "");

        if (invoice.items && invoice.items.length > 0) {
          setInvoiceItems(
            invoice.items.map((item: { itemId?: string; item?: { id: string }; quantity: number; rate: number; taxRate: number; taxAmount: number; amount: number }) => ({
              id: generateId(),
              itemId: item.itemId || item.item?.id,
              quantity: Number(item.quantity),
              rate: Number(item.rate),
              taxRate: Number(item.taxRate),
              taxAmount: Number(item.taxAmount),
              amount: Number(item.amount),
            }))
          );
        }
      } else {
        setError("Failed to load invoice");
      }
    } catch (err) {
      console.error("Error loading invoice:", err);
      setError("Failed to load invoice");
    } finally {
      setIsLoadingInvoice(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    if (editId) {
      loadInvoice(editId);
    }
  }, [fetchItems, editId, loadInvoice]);

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
      setInvoiceItems((prev) => {
        const updated = [...prev];
        const item = { ...updated[index] };

        if (field === "itemId") {
          item.itemId = value as string;
          const selectedItem = items.find((i) => i.id === value);
          if (selectedItem) {
            item.rate = Number(selectedItem.sellingPrice) || 0;
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
    setInvoiceItems((prev) => [
      ...prev,
      { id: generateId(), itemId: "", quantity: 1, rate: 0, taxRate: 0, taxAmount: 0, amount: 0 },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (invoiceItems.length > 1) {
      setInvoiceItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const totals = useMemo(() => {
    const subtotal = invoiceItems.reduce((sum, item) => sum + item.amount, 0);
    const totalTax = invoiceItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const rawTotal = subtotal + totalTax;
    const roundOff = Math.round(rawTotal) - rawTotal;
    const totalAmount = Math.round(rawTotal);
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      roundOff: Math.round(roundOff * 100) / 100,
      totalAmount,
    };
  }, [invoiceItems]);

  const handleSubmit = async () => {
    setError(null);

    if (!dueDate) {
      setError("Please select a due date");
      return;
    }

    const validItems = invoiceItems.filter((item) => item.itemId && item.quantity > 0);
    if (validItems.length === 0) {
      setError("Please add at least one item with quantity");
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        dueDate,
        notes: notes || null,
        items: validItems.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          rate: item.rate,
          taxRate: item.taxRate,
        })),
      };

      const response = await fetch(`/api/sales-invoices/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update invoice");
      }

      mutate((key: string) => key.startsWith("/api/sales-invoices"));
      router.push("/sales/invoices");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  const usedItemIds = useMemo(() => new Set(invoiceItems.map((item) => item.itemId).filter(Boolean)), [invoiceItems]);

  // Derive unique brands from items
  const uniqueBrands = useMemo(() => {
    const seen = new Set<string>();
    const brands: { id: string; name: string }[] = [];
    for (const item of items) {
      if (item.brand && !seen.has(item.brand.id)) {
        seen.add(item.brand.id);
        brands.push(item.brand);
      }
    }
    return brands.sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  // Sub-brands for selected brand
  const filteredSubBrands = useMemo(() => {
    const seen = new Set<string>();
    const subBrands: { id: string; name: string }[] = [];
    for (const item of items) {
      if (filterBrandId && item.brandId !== filterBrandId) continue;
      if (item.subBrand && !seen.has(item.subBrand.id)) {
        seen.add(item.subBrand.id);
        subBrands.push(item.subBrand);
      }
    }
    return subBrands.sort((a, b) => a.name.localeCompare(b.name));
  }, [items, filterBrandId]);

  // Items filtered by brand/sub-brand selection
  const filteredItems = useMemo(() => {
    let result = items;
    if (filterBrandId) result = result.filter((i) => i.brandId === filterBrandId);
    if (filterSubBrandId) result = result.filter((i) => i.subBrandId === filterSubBrandId);
    return result;
  }, [items, filterBrandId, filterSubBrandId]);

  if (!editId) {
    return null;
  }

  if (isLoadingInvoice) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/sales/invoices")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoices
          </Button>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Edit Sales Invoice{invoiceNumber ? ` - ${invoiceNumber}` : ""}
          </h1>
          <p className="text-gray-600">
            Update invoice details for {customerName}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
        )}

        <div className="space-y-6">
          {/* Invoice Details */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Invoice Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                <Input value={invoiceNumber} disabled className="bg-gray-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                <Input value={customerName} disabled className="bg-gray-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Items</h2>
              <Button variant="outline" size="sm" onClick={handleAddItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

            {/* Brand / Sub-brand filter */}
            {uniqueBrands.length > 0 && (
              <div className="flex gap-3 mb-4">
                <select
                  value={filterBrandId}
                  onChange={(e) => { setFilterBrandId(e.target.value); setFilterSubBrandId(""); }}
                  className="flex-1 h-9 rounded-md border border-gray-200 px-3 text-sm bg-white"
                >
                  <option value="">All Brands</option>
                  {uniqueBrands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <select
                  value={filterSubBrandId}
                  onChange={(e) => setFilterSubBrandId(e.target.value)}
                  disabled={filteredSubBrands.length === 0}
                  className="flex-1 h-9 rounded-md border border-gray-200 px-3 text-sm bg-white disabled:opacity-50"
                >
                  <option value="">All Sub-brands</option>
                  {filteredSubBrands.map((sb) => (
                    <option key={sb.id} value={sb.id}>{sb.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-3">
              {invoiceItems.map((invoiceItem, index) => {
                // Show filtered items but always include the currently selected item
                const rowItems = filterBrandId || filterSubBrandId
                  ? [
                      ...filteredItems,
                      ...(invoiceItem.itemId && !filteredItems.find(i => i.id === invoiceItem.itemId)
                        ? items.filter(i => i.id === invoiceItem.itemId)
                        : []),
                    ]
                  : items;
                return (
                <div key={invoiceItem.id} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    {index === 0 && (
                      <label className="block text-xs font-medium text-gray-600 mb-1">Item</label>
                    )}
                    <select
                      value={invoiceItem.itemId}
                      onChange={(e) => handleItemChange(index, "itemId", e.target.value)}
                      className="w-full h-10 rounded-md border border-gray-200 px-3 text-sm"
                    >
                      <option value="">Select item...</option>
                      {rowItems.map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                          disabled={usedItemIds.has(item.id) && invoiceItem.itemId !== item.id}
                        >
                          {item.itemCode} - {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    {index === 0 && (
                      <label className="block text-xs font-medium text-gray-600 mb-1">Qty</label>
                    )}
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      value={invoiceItem.quantity || ""}
                      onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    {index === 0 && (
                      <label className="block text-xs font-medium text-gray-600 mb-1">Rate</label>
                    )}
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={invoiceItem.rate || ""}
                      onChange={(e) => handleItemChange(index, "rate", e.target.value)}
                    />
                  </div>
                  <div className="col-span-1">
                    {index === 0 && (
                      <label className="block text-xs font-medium text-gray-600 mb-1">Tax %</label>
                    )}
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={invoiceItem.taxRate || ""}
                      onChange={(e) => handleItemChange(index, "taxRate", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    {index === 0 && (
                      <label className="block text-xs font-medium text-gray-600 mb-1">Amount</label>
                    )}
                    <Input
                      value={(invoiceItem.amount + invoiceItem.taxAmount).toFixed(2)}
                      disabled
                      className="bg-gray-50 text-right"
                    />
                  </div>
                  <div className="col-span-1">
                    {index === 0 && (
                      <label className="block text-xs font-medium text-gray-600 mb-1">&nbsp;</label>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(index)}
                      disabled={invoiceItems.length === 1}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            </div>

            {/* Totals */}
            <div className="mt-6 border-t pt-4">
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">{totals.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax:</span>
                    <span className="font-medium">{totals.totalTax.toFixed(2)}</span>
                  </div>
                  {totals.roundOff !== 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Round Off:</span>
                      <span className="font-medium">{totals.roundOff.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span>{totals.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Notes</h2>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
              rows={3}
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => router.push("/sales/invoices")}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-teal-500 hover:bg-teal-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Update Invoice
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function EditSalesInvoicePage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="p-6 flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
          </div>
        </DashboardLayout>
      }
    >
      <EditSalesInvoiceContent />
    </Suspense>
  );
}
