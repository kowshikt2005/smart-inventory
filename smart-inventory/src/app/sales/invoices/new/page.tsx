"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Loader2, Plus, Save, Trash2, Lock } from "lucide-react";
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
  // Items loaded from invoice (may be inactive, not returned by activeOnly fetch)
  const [invoiceLoadedItems, setInvoiceLoadedItems] = useState<Item[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItemData[]>([]);
  const [, setIsLoadingItems] = useState(false);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(true);

  const [filterBrandId, setFilterBrandId] = useState("");
  const [filterSubBrandId, setFilterSubBrandId] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditBlocked, setIsEditBlocked] = useState(false);

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
        // Block editing if invoice is fully paid or cancelled
        if (invoice.paymentStatus === 'PAID' || invoice.paymentStatus === 'CANCELLED') {
          setIsEditBlocked(true);
          setInvoiceNumber(invoice.invoiceNumber || "");
          return;
        }
        setInvoiceNumber(invoice.invoiceNumber || "");
        setCustomerName(invoice.customer?.name || "");
        setDueDate(invoice.dueDate ? new Date(invoice.dueDate).toISOString().split("T")[0] : "");
        setNotes(invoice.notes || "");

        if (invoice.items && invoice.items.length > 0) {
          // Extract item details from invoice so inactive items still display
          const loadedItems: Item[] = invoice.items
            .filter((inv: { item?: Item }) => inv.item)
            .map((inv: { item: Item }) => inv.item);
          setInvoiceLoadedItems(loadedItems);

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
          const selectedItem = allItems.find((i) => i.id === value);
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
    [allItems, calculateLineItem]
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

    // Check for duplicate items
    const itemIdCounts = validItems.reduce((acc, item) => {
      acc[item.itemId] = (acc[item.itemId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const duplicateIds = Object.keys(itemIdCounts).filter((id) => itemIdCounts[id] > 1);
    if (duplicateIds.length > 0) {
      const dupNames = duplicateIds.map((id) => {
        const found = allItems.find((i: { id: string; name: string }) => i.id === id);
        return found ? found.name : id;
      });
      setError(`Duplicate items found: ${dupNames.join(", ")}. Please merge them into one row.`);
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

  // Merge active items with items loaded from invoice (handles inactive items)
  const allItems = useMemo(() => {
    const ids = new Set(items.map((i) => i.id));
    const extras = invoiceLoadedItems.filter((i) => !ids.has(i.id));
    return [...items, ...extras];
  }, [items, invoiceLoadedItems]);

  // Derive unique brands from allItems
  const uniqueBrands = useMemo(() => {
    const seen = new Set<string>();
    const brands: { id: string; name: string }[] = [];
    for (const item of allItems) {
      if (item.brand && !seen.has(item.brand.id)) {
        seen.add(item.brand.id);
        brands.push(item.brand);
      }
    }
    return brands.sort((a, b) => a.name.localeCompare(b.name));
  }, [allItems]);

  // Sub-brands for selected brand
  const filteredSubBrands = useMemo(() => {
    const seen = new Set<string>();
    const subBrands: { id: string; name: string }[] = [];
    for (const item of allItems) {
      if (filterBrandId && item.brandId !== filterBrandId) continue;
      if (item.subBrand && !seen.has(item.subBrand.id)) {
        seen.add(item.subBrand.id);
        subBrands.push(item.subBrand);
      }
    }
    return subBrands.sort((a, b) => a.name.localeCompare(b.name));
  }, [allItems, filterBrandId]);

  // Items filtered by brand/sub-brand selection
  const filteredItems = useMemo(() => {
    let result = allItems;
    if (filterBrandId) result = result.filter((i) => i.brandId === filterBrandId);
    if (filterSubBrandId) result = result.filter((i) => i.subBrandId === filterSubBrandId);
    return result;
  }, [allItems, filterBrandId, filterSubBrandId]);

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
      {/* Blocked edit popup */}
      <AlertDialog open={isEditBlocked} onOpenChange={() => {}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-red-500" />
              Cannot Edit Invoice
            </AlertDialogTitle>
            <AlertDialogDescription>
              Invoice <strong>#{invoiceNumber}</strong> has been fully paid and cannot be edited.
              Paid invoices are locked to preserve accurate financial records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => router.push("/sales/invoices")} className="bg-teal-500 hover:bg-teal-600">
              Go Back to Invoices
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="min-h-screen bg-gray-50">
        {/* Sticky action bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => router.push("/sales/invoices")} className="text-gray-500 -ml-2">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div className="h-4 w-px bg-gray-200" />
              <div>
                <span className="text-base font-bold text-gray-900">
                  Edit Sales Invoice{invoiceNumber ? ` — ${invoiceNumber}` : ""}
                </span>
                {customerName && (
                  <span className="ml-2 text-sm text-gray-400">{customerName}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => router.push("/sales/invoices")}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || isEditBlocked} className="bg-teal-500 hover:bg-teal-600 text-white">
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Updating...</>
                ) : (
                  <><Save className="h-4 w-4 mr-1.5" />Update Invoice</>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {/* Row 1: Invoice meta (read-only left) + Due date (editable right) */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Invoice Info</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                <span className="text-gray-400">Invoice #</span>
                <span className="font-medium text-gray-900">{invoiceNumber}</span>
                <span className="text-gray-400">Customer</span>
                <span className="font-medium text-gray-900">{customerName || "—"}</span>
              </div>
            </div>
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Edit Details</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Due Date <span className="text-red-500">*</span>
                </label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Row 2: Items table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Line Items</p>
              <div className="flex items-center gap-3">
                {uniqueBrands.length > 0 && (
                  <>
                    <select
                      value={filterBrandId}
                      onChange={(e) => { setFilterBrandId(e.target.value); setFilterSubBrandId(""); }}
                      className="h-8 rounded-md border border-gray-200 px-2 text-xs bg-white"
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
                      className="h-8 rounded-md border border-gray-200 px-2 text-xs bg-white disabled:opacity-40"
                    >
                      <option value="">All Sub-brands</option>
                      {filteredSubBrands.map((sb) => (
                        <option key={sb.id} value={sb.id}>{sb.name}</option>
                      ))}
                    </select>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={handleAddItem} className="h-8">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Item
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Qty</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Rate</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Tax %</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Amount</th>
                    <th className="px-3 py-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invoiceItems.map((invoiceItem, index) => {
                    const rowItems = filterBrandId || filterSubBrandId
                      ? [
                          ...filteredItems,
                          ...(invoiceItem.itemId && !filteredItems.find(i => i.id === invoiceItem.itemId)
                            ? allItems.filter(i => i.id === invoiceItem.itemId)
                            : []),
                        ]
                      : allItems;
                    return (
                      <tr key={invoiceItem.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <select
                            value={invoiceItem.itemId}
                            onChange={(e) => handleItemChange(index, "itemId", e.target.value)}
                            className="w-full h-9 rounded-md border border-gray-200 px-3 text-sm bg-white"
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
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number" step="0.001" min="0"
                            value={invoiceItem.quantity || ""}
                            onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                            className="text-right h-9"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number" step="0.01" min="0"
                            value={invoiceItem.rate || ""}
                            onChange={(e) => handleItemChange(index, "rate", e.target.value)}
                            className="text-right h-9"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number" step="0.01" min="0"
                            value={invoiceItem.taxRate || ""}
                            onChange={(e) => handleItemChange(index, "taxRate", e.target.value)}
                            className="text-right h-9"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={(invoiceItem.amount + invoiceItem.taxAmount).toFixed(2)}
                            disabled
                            className="bg-gray-50 text-right h-9 font-medium"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => handleRemoveItem(index)}
                            disabled={invoiceItems.length === 1}
                            className="h-9 w-9 p-0 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Row 3: Notes (left) + Summary (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Notes</p>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes..."
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium">{totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tax</span>
                  <span className="font-medium">{totals.totalTax.toFixed(2)}</span>
                </div>
                {totals.roundOff !== 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Round Off</span>
                    <span className="font-medium">{totals.roundOff.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span className="text-teal-600">{totals.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
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
