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
import { PurchaseOrderItemRow } from "@/components/purchase-orders/PurchaseOrderItemRow";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Save,
  Search,
  X,
  Calculator,
  Copy,
  Lock,
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

interface InvoiceItemData {
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

function NewPurchaseInvoicePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const purchaseOrderId = searchParams.get("purchaseOrderId");
  const editId = searchParams.get("edit");
  const copyId = searchParams.get("copy");

  // Form state
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [roundOff, setRoundOff] = useState(0);

  // Vendor state
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorSearch, setVendorSearch] = useState("");
  const [isLoadingVendors, setIsLoadingVendors] = useState(false);

  // Items state
  const [items, setItems] = useState<Item[]>([]);
  // Extra items loaded from an existing invoice (may be inactive, not returned by activeOnly fetch)
  const [invoiceLoadedItems, setInvoiceLoadedItems] = useState<Item[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItemData[]>([
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
  const [invoiceNumber, setInvoiceNumber] = useState("Loading...");
  const [isEditBlocked, setIsEditBlocked] = useState(false);

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

  const loadPurchaseOrder = useCallback(async (orderId: string) => {
    try {
      const response = await fetch(`/api/purchase-orders/${orderId}`);
      if (response.ok) {
        const order = await response.json();
        setSelectedVendor(order.vendor);

        if (order.vendor.creditDays) {
          const due = new Date();
          due.setDate(due.getDate() + order.vendor.creditDays);
          setDueDate(due.toISOString().split("T")[0]);
        }

        if (order.items && order.items.length > 0) {
          interface OrderItem {
            id: string;
            itemId: string;
            quantity: number;
            rate: number;
            taxRate: number;
            taxAmount: number;
            amount: number;
          }
          setInvoiceItems(
            order.items.map((item: OrderItem) => ({
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
      console.error("Error loading purchase order:", err);
    }
  }, []);

  const loadInvoiceForEdit = useCallback(async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/purchase-invoices/${invoiceId}`);
      if (response.ok) {
        const invoice = await response.json();
        // Block editing if invoice is fully paid or cancelled
        if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
          setIsEditBlocked(true);
          setInvoiceNumber(invoice.invoiceNumber || "");
          return;
        }
        setInvoiceNumber(invoice.invoiceNumber || "");
        setInvoiceDate(
          invoice.date
            ? new Date(invoice.date).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0]
        );
        setDueDate(
          invoice.dueDate
            ? new Date(invoice.dueDate).toISOString().split("T")[0]
            : ""
        );
        setNotes(invoice.notes || "");
        setSelectedVendor(invoice.vendor);

        if (invoice.items && invoice.items.length > 0) {
          // Extract item details from invoice response (includes inactive items)
          // so PurchaseOrderItemRow can display names even if item is now inactive
          const loadedItems: Item[] = invoice.items
            .filter((inv: { item?: Item }) => inv.item)
            .map((inv: { item: Item }) => inv.item);
          setInvoiceLoadedItems(loadedItems);

          setInvoiceItems(
            invoice.items.map(
              (item: {
                itemId: string;
                quantity: number;
                rate: number;
                taxRate: number;
                taxAmount: number;
                amount: number;
              }) => ({
                id: generateId(),
                itemId: item.itemId,
                quantity: Number(item.quantity),
                rate: Number(item.rate),
                taxRate: Number(item.taxRate),
                taxAmount: Number(item.taxAmount),
                amount: Number(item.amount),
              })
            )
          );
        }
      }
    } catch (err) {
      console.error("Error loading invoice for edit:", err);
    }
  }, []);

  // Load invoice data for copy (pre-fills vendor + items, creates a new invoice)
  const loadInvoiceForCopy = useCallback(async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/purchase-invoices/${invoiceId}`);
      if (response.ok) {
        const invoice = await response.json();
        setNotes(invoice.notes || "");
        setTerms(invoice.terms || "");
        setSelectedVendor(invoice.vendor);

        if (invoice.vendor?.creditDays) {
          const due = new Date();
          due.setDate(due.getDate() + invoice.vendor.creditDays);
          setDueDate(due.toISOString().split("T")[0]);
        }

        if (invoice.items && invoice.items.length > 0) {
          const loadedItems: Item[] = invoice.items
            .filter((inv: { item?: Item }) => inv.item)
            .map((inv: { item: Item }) => inv.item);
          setInvoiceLoadedItems(loadedItems);

          setInvoiceItems(
            invoice.items.map((item: {
              itemId: string;
              quantity: number;
              rate: number;
              taxRate: number;
              taxAmount: number;
              amount: number;
            }) => ({
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
      console.error("Error loading invoice for copy:", err);
    }
  }, []);

  // Fetch next invoice number for new invoices
  const fetchNextInvoiceNumber = useCallback(async () => {
    try {
      const response = await fetch("/api/purchase-invoices/next-number");
      if (response.ok) {
        const data = await response.json();
        setInvoiceNumber(data.invoiceNumber);
      }
    } catch (err) {
      console.error("Error fetching next invoice number:", err);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
    fetchItems();
  }, [fetchVendors, fetchItems]);

  useEffect(() => {
    if (editId) {
      loadInvoiceForEdit(editId);
    } else {
      fetchNextInvoiceNumber();
      if (purchaseOrderId) {
        loadPurchaseOrder(purchaseOrderId);
      } else if (copyId) {
        loadInvoiceForCopy(copyId);
      }
    }
  }, [
    editId,
    copyId,
    loadInvoiceForEdit,
    loadInvoiceForCopy,
    fetchNextInvoiceNumber,
    purchaseOrderId,
    loadPurchaseOrder,
  ]);

  // Set due date when vendor is selected
  useEffect(() => {
    if (selectedVendor && !dueDate) {
      const due = new Date();
      due.setDate(due.getDate() + (selectedVendor.creditDays || 30));
      setDueDate(due.toISOString().split("T")[0]);
    }
  }, [selectedVendor, dueDate]);

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

  // Merge fetched items with items loaded from existing invoice (for edit/copy)
  // so items that are now inactive still display correctly
  const allItems = useMemo(() => {
    const ids = new Set(items.map((i) => i.id));
    const extras = invoiceLoadedItems.filter((i) => !ids.has(i.id));
    return [...items, ...extras];
  }, [items, invoiceLoadedItems]);

  // Get selected item IDs
  const selectedItemIds = useMemo(
    () => invoiceItems.map((item) => item.itemId).filter(Boolean),
    [invoiceItems]
  );

  // Handle adding new item row
  const handleAddItem = () => {
    setInvoiceItems((prev) => [
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
  const handleUpdateItem = (index: number, updatedItem: InvoiceItemData) => {
    setInvoiceItems((prev) => {
      const newItems = [...prev];
      newItems[index] = updatedItem;
      return newItems;
    });
  };

  // Handle removing item row
  const handleRemoveItem = (index: number) => {
    if (invoiceItems.length === 1) {
      setInvoiceItems([
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
      setInvoiceItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // Calculate totals
  const totals = useMemo(() => {
    const validItems = invoiceItems.filter(
      (item) => item.itemId && item.amount > 0
    );
    const subtotal = validItems.reduce((sum, item) => sum + item.amount, 0);
    const totalTax = validItems.reduce(
      (sum, item) => sum + item.taxAmount,
      0
    );
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
  }, [invoiceItems, roundOff]);

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

    if (!invoiceDate) {
      setError("Please select an invoice date");
      return;
    }

    if (!dueDate) {
      setError("Please select a due date");
      return;
    }

    const validItems = invoiceItems.filter(
      (item) => item.itemId && item.quantity > 0 && item.rate > 0
    );

    if (validItems.length === 0) {
      setError("Please add at least one item with valid quantity and rate");
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
        const found = allItems.find((i) => i.id === id);
        return found ? found.name : id;
      });
      setError(`Duplicate items found: ${dupNames.join(", ")}. Please merge them into one row.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        vendorId: selectedVendor.id,
        purchaseOrderId: purchaseOrderId || null,
        date: invoiceDate,
        dueDate,
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
        ? `/api/purchase-invoices/${editId}`
        : "/api/purchase-invoices";
      const method = editId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save invoice");
      }

      mutate(
        (key) =>
          typeof key === "string" && key.includes("/api/purchase-invoices"),
        undefined,
        { revalidate: true }
      );
      router.push("/purchases/invoices");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <AlertDialogAction onClick={() => router.push("/purchases/invoices")} className="bg-teal-500 hover:bg-teal-600">
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
              <Button variant="ghost" size="sm" onClick={() => router.push("/purchases/invoices")} className="text-gray-500 -ml-2">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div className="h-4 w-px bg-gray-200" />
              <div>
                <span className="text-base font-bold text-gray-900">
                  {editId ? "Edit Purchase Invoice" : copyId ? "Duplicate Purchase Invoice" : "New Purchase Invoice"}
                </span>
                <span className="ml-2 text-sm text-gray-400">#{invoiceNumber}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => router.push("/purchases/invoices")}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || isEditBlocked} className="bg-teal-500 hover:bg-teal-600 text-white">
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving...</>
                ) : (
                  <><Save className="h-4 w-4 mr-1.5" />{editId ? "Update Invoice" : "Create Invoice"}</>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {copyId && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700 text-sm flex items-center gap-2">
              <Copy className="h-4 w-4 shrink-0" />
              Duplicating from an existing invoice — review and save to create a new invoice.
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {/* Row 1: Dates (left) + Vendor (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Invoice Details</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Invoice Date <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

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
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search by name, vendor number, or GSTIN..."
                        value={vendorSearch}
                        onChange={(e) => setVendorSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  )}
                  {vendorSearch && !selectedVendor && (
                    <div className="border rounded-lg max-h-44 overflow-y-auto bg-white shadow-sm">
                      {filteredVendors.length === 0 ? (
                        <p className="p-3 text-gray-500 text-sm">No vendors found</p>
                      ) : (
                        filteredVendors.map((vendor) => (
                          <button
                            key={vendor.id}
                            type="button"
                            onClick={() => { setSelectedVendor(vendor); setVendorSearch(""); }}
                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b last:border-b-0"
                          >
                            <p className="text-sm font-medium">{vendor.name}</p>
                            <p className="text-xs text-gray-500">
                              {vendor.vendorNumber}
                              {vendor.gstin && ` · GSTIN: ${vendor.gstin}`}
                              {vendor.city && ` · ${vendor.city}`}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  {selectedVendor && (
                    <div className="flex items-center justify-between px-4 py-3 bg-teal-50 border border-teal-200 rounded-lg">
                      <div>
                        <p className="font-medium text-teal-900">{selectedVendor.name}</p>
                        <p className="text-sm text-teal-600">
                          {selectedVendor.vendorNumber}
                          {selectedVendor.gstin && ` · GSTIN: ${selectedVendor.gstin}`}
                        </p>
                      </div>
                      {!purchaseOrderId && (
                        <button type="button" onClick={() => setSelectedVendor(null)} className="text-teal-500 hover:text-teal-700 ml-3">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Items table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Line Items</p>
              <Button type="button" variant="outline" size="sm" onClick={handleAddItem} className="h-8">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Item
              </Button>
            </div>
            {isLoadingItems ? (
              <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading items...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">HSN</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Qty</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">Unit</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Rate</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">GST %</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Tax</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Total</th>
                      <th className="px-3 py-2.5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceItems.map((item, index) => (
                      <PurchaseOrderItemRow
                        key={item.id}
                        item={item}
                        items={allItems}
                        selectedItemIds={selectedItemIds}
                        onUpdate={(updatedItem) => handleUpdateItem(index, updatedItem)}
                        onRemove={() => handleRemoveItem(index)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Row 3: Notes/Terms (left) + Summary (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Notes</p>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes about this invoice..."
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Terms & Conditions</p>
                <Textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="Terms and conditions..."
                  rows={3}
                  className="resize-none"
                />
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

export default function NewPurchaseInvoicePage() {
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
      <NewPurchaseInvoicePageContent />
    </Suspense>
  );
}
