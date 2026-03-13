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
import { ArrowLeft, Loader2, Plus, Save, Search, X, Calculator, Trash2, Lock } from "lucide-react";
import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { mutate } from "swr";

interface Customer {
  id: string;
  customerNumber: string;
  name: string;
  gstin: string | null;
  creditDays: number;
  address: string | null;
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
  sellingPrice: number;
  mrp: number;
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
  discountPercent: number;
  isGstInclusive: boolean;
}

const generateId = () => `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const emptyItem = (): InvoiceItemData => ({
  id: generateId(),
  itemId: "",
  quantity: 1,
  rate: 0,
  taxRate: 0,
  taxAmount: 0,
  amount: 0,
  discountPercent: 0,
  isGstInclusive: false,
});

function NewSalesInvoiceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  // Form state
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [roundOff, setRoundOff] = useState(0);
  const [invoiceNumber, setInvoiceNumber] = useState("Loading...");

  // Customer state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);

  // Items state
  const [items, setItems] = useState<Item[]>([]);
  // Items loaded from invoice (may be inactive, not returned by activeOnly fetch)
  const [invoiceLoadedItems, setInvoiceLoadedItems] = useState<Item[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItemData[]>([emptyItem()]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [filterBrandId, setFilterBrandId] = useState("");
  const [filterSubBrandId, setFilterSubBrandId] = useState("");

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditBlocked, setIsEditBlocked] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      setIsLoadingCustomers(true);
      const res = await fetch("/api/customers?limit=500&activeOnly=true");
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
      }
    } catch (err) {
      console.error("Error fetching customers:", err);
    } finally {
      setIsLoadingCustomers(false);
    }
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      setIsLoadingItems(true);
      const url = editId ? "/api/items?limit=9999" : "/api/items?limit=9999&activeOnly=true";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Error fetching items:", err);
    } finally {
      setIsLoadingItems(false);
    }
  }, [editId]);

  const fetchNextInvoiceNumber = useCallback(async () => {
    try {
      const res = await fetch("/api/sales-invoices/next-number");
      if (res.ok) {
        const data = await res.json();
        setInvoiceNumber(data.invoiceNumber);
      }
    } catch (err) {
      console.error("Error fetching invoice number:", err);
    }
  }, []);

  const loadInvoiceForEdit = useCallback(async (invoiceId: string) => {
    try {
      setIsLoadingInvoice(true);
      const res = await fetch(`/api/sales-invoices/${invoiceId}`);
      if (res.ok) {
        const invoice = await res.json();
        // Block editing if invoice is fully paid or cancelled
        if (invoice.paymentStatus === 'PAID' || invoice.paymentStatus === 'CANCELLED') {
          setIsEditBlocked(true);
          setInvoiceNumber(invoice.invoiceNumber || "");
          return;
        }
        setInvoiceNumber(invoice.invoiceNumber || "");
        setInvoiceDate(invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
        setDueDate(invoice.dueDate ? new Date(invoice.dueDate).toISOString().split("T")[0] : "");
        setNotes(invoice.notes || "");
        setRef(invoice.ref || "");
        if (invoice.customer) setSelectedCustomer(invoice.customer);
        if (invoice.items && invoice.items.length > 0) {
          // Extract item details so inactive items still display
          const loadedItems: Item[] = invoice.items
            .filter((inv: { item?: Item }) => inv.item)
            .map((inv: { item: Item }) => inv.item);
          setInvoiceLoadedItems(loadedItems);

          setInvoiceItems(invoice.items.map((item: { itemId?: string; item?: { id: string }; quantity: number; rate: number; taxRate: number; taxAmount: number; amount: number; discountPercent?: number }) => ({
            id: generateId(),
            itemId: item.itemId || item.item?.id || "",
            quantity: Number(item.quantity),
            rate: Number(item.rate),
            taxRate: Number(item.taxRate),
            taxAmount: Number(item.taxAmount),
            amount: Number(item.amount),
            discountPercent: Number(item.discountPercent || 0),
            isGstInclusive: false,
          })));
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
    fetchCustomers();
    fetchItems();
    if (editId) {
      loadInvoiceForEdit(editId);
    } else {
      fetchNextInvoiceNumber();
    }
  }, [fetchCustomers, fetchItems, editId, loadInvoiceForEdit, fetchNextInvoiceNumber]);

  // Merge active items with items loaded from invoice (handles inactive items)
  const allItems = useMemo(() => {
    const ids = new Set(items.map((i) => i.id));
    const extras = invoiceLoadedItems.filter((i) => !ids.has(i.id));
    return [...items, ...extras];
  }, [items, invoiceLoadedItems]);

  // Auto-set due date when customer selected
  useEffect(() => {
    if (selectedCustomer && !dueDate) {
      const due = new Date();
      due.setDate(due.getDate() + (selectedCustomer.creditDays || 30));
      setDueDate(due.toISOString().split("T")[0]);
    }
  }, [selectedCustomer, dueDate]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return [];
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.customerNumber.toLowerCase().includes(q) || (c.gstin && c.gstin.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [customers, customerSearch]);

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

  const filteredItems = useMemo(() => {
    let result = allItems;
    if (filterBrandId) result = result.filter((i) => i.brandId === filterBrandId);
    if (filterSubBrandId) result = result.filter((i) => i.subBrandId === filterSubBrandId);
    return result;
  }, [allItems, filterBrandId, filterSubBrandId]);

  const usedItemIds = useMemo(() => new Set(invoiceItems.map((i) => i.itemId).filter(Boolean)), [invoiceItems]);

  const handleItemFieldChange = useCallback(
    (index: number, field: string, value: string | number) => {
      setInvoiceItems((prev) => {
        const updated = [...prev];
        const row = { ...updated[index] };

        if (field === "itemId") {
          row.itemId = value as string;
          const selectedItem = items.find((i) => i.id === value);
          if (selectedItem) {
            row.rate = Number(selectedItem.sellingPrice) || 0;
            row.taxRate = Number(selectedItem.gstRate) || 0;
            row.discountPercent = 0;
            row.isGstInclusive = false;
          }
        } else if (field === "quantity") {
          row.quantity = Number(value) || 0;
        } else if (field === "rate") {
          row.rate = Number(value) || 0;
        } else if (field === "taxRate") {
          row.taxRate = Number(value) || 0;
        } else if (field === "discountPercent") {
          row.discountPercent = Number(value) || 0;
        }

        // Recalculate
        const qty = row.quantity;
        const rate = row.rate;
        const discount = row.discountPercent;
        const discountedRate = rate * (1 - discount / 100);
        const base = qty * discountedRate;
        const tax = base * (row.taxRate / 100);
        row.amount = Math.round(base * 100) / 100;
        row.taxAmount = Math.round(tax * 100) / 100;

        updated[index] = row;
        return updated;
      });
    },
    [items]
  );

  const handleAddItem = () => {
    setInvoiceItems((prev) => [...prev, emptyItem()]);
  };

  const handleRemoveItem = (index: number) => {
    if (invoiceItems.length > 1) {
      setInvoiceItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const totals = useMemo(() => {
    const subtotal = invoiceItems.reduce((s, i) => s + i.amount, 0);
    const totalTax = invoiceItems.reduce((s, i) => s + i.taxAmount, 0);
    const total = subtotal + totalTax + roundOff;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      cgst: Math.round((totalTax / 2) * 100) / 100,
      sgst: Math.round((totalTax / 2) * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }, [invoiceItems, roundOff]);

  const handleSubmit = async () => {
    setError(null);

    if (!editId && !selectedCustomer) {
      setError("Please select a customer");
      return;
    }
    if (!invoiceDate) {
      setError("Please select an invoice date");
      return;
    }

    const validItems = invoiceItems.filter((i) => i.itemId && i.quantity > 0);
    if (validItems.length === 0) {
      setError("Please add at least one item");
      return;
    }

    setIsSubmitting(true);
    try {
      let response: Response;

      if (editId) {
        response = await fetch(`/api/sales-invoices/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dueDate,
            notes: notes || null,
            items: validItems.map((i) => ({ itemId: i.itemId, quantity: i.quantity, rate: i.rate, taxRate: i.taxRate })),
          }),
        });
      } else {
        response = await fetch("/api/sales-invoices/direct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: selectedCustomer!.id,
            invoiceDate,
            dueDate,
            ref: ref || null,
            notes: notes || null,
            roundOff,
            items: validItems.map((i) => ({
              itemId: i.itemId,
              quantity: i.quantity,
              rate: i.rate,
              taxRate: i.taxRate,
              discountPercent: i.discountPercent,
              isGstInclusive: i.isGstInclusive,
            })),
          }),
        });
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save invoice");

      mutate((key: unknown) => typeof key === "string" && key.startsWith("/api/sales-invoices"));
      router.push("/sales/invoices");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingInvoice || isLoadingItems) {
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
                  {editId ? "Edit Sales Invoice" : "New Sales Invoice"}
                </span>
                <span className="ml-2 text-sm text-gray-400">#{invoiceNumber}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => router.push("/sales/invoices")}>Cancel</Button>
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
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {/* Row 1: Invoice details + Customer */}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date</label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Reference #</label>
                  <Input
                    type="text"
                    placeholder="Quotes, Sales order, Delivery Challan..."
                    value={ref}
                    onChange={(e) => setRef(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Customer <span className="text-red-400">*</span>
              </p>
              {isLoadingCustomers ? (
                <div className="flex items-center gap-2 text-gray-500 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading customers...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {!selectedCustomer && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search by name, customer number, or GSTIN..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  )}
                  {customerSearch && !selectedCustomer && (
                    <div className="border rounded-lg max-h-44 overflow-y-auto bg-white shadow-sm">
                      {filteredCustomers.length === 0 ? (
                        <p className="p-3 text-gray-500 text-sm">No customers found</p>
                      ) : (
                        filteredCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => { setSelectedCustomer(customer); setCustomerSearch(""); }}
                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b last:border-b-0"
                          >
                            <p className="text-sm font-medium">{customer.name}</p>
                            <p className="text-xs text-gray-500">
                              {customer.customerNumber}
                              {customer.gstin && ` · GSTIN: ${customer.gstin}`}
                              {customer.city && ` · ${customer.city}`}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  {selectedCustomer && (
                    <div className="flex items-center justify-between px-4 py-3 bg-teal-50 border border-teal-200 rounded-lg">
                      <div>
                        <p className="font-medium text-teal-900">{selectedCustomer.name}</p>
                        <p className="text-sm text-teal-600">
                          {selectedCustomer.customerNumber}
                          {selectedCustomer.gstin && ` · GSTIN: ${selectedCustomer.gstin}`}
                        </p>
                      </div>
                      {!editId && (
                        <button type="button" onClick={() => setSelectedCustomer(null)} className="text-teal-500 hover:text-teal-700 ml-3">
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
              <div className="flex items-center gap-2">
                {uniqueBrands.length > 0 && (
                  <>
                    <select
                      value={filterBrandId}
                      onChange={(e) => { setFilterBrandId(e.target.value); setFilterSubBrandId(""); }}
                      className="h-8 rounded-md border border-gray-200 px-2 text-xs bg-white"
                    >
                      <option value="">All Brands</option>
                      {uniqueBrands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <select
                      value={filterSubBrandId}
                      onChange={(e) => setFilterSubBrandId(e.target.value)}
                      disabled={filteredSubBrands.length === 0}
                      className="h-8 rounded-md border border-gray-200 px-2 text-xs bg-white disabled:opacity-40"
                    >
                      <option value="">All Sub-brands</option>
                      {filteredSubBrands.map((sb) => <option key={sb.id} value={sb.id}>{sb.name}</option>)}
                    </select>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={handleAddItem} className="h-8">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Item
                </Button>
              </div>
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
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">S.No</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">HSN/SAC</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">Tax %</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Qty</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">Unit</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Rate ₹</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">MRP</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Disc %</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Amount</th>
                      <th className="px-2 py-2.5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {invoiceItems.map((row, index) => {
                      const rowItems = filterBrandId || filterSubBrandId
                        ? [...filteredItems, ...(row.itemId && !filteredItems.find(i => i.id === row.itemId) ? allItems.filter(i => i.id === row.itemId) : [])]
                        : allItems;
                      const selectedItem = items.find((i) => i.id === row.itemId);
                      return (
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-center text-sm text-gray-500">{index + 1}</td>
                          <td className="px-4 py-2">
                            <select
                              value={row.itemId}
                              onChange={(e) => handleItemFieldChange(index, "itemId", e.target.value)}
                              className="w-full h-9 rounded-md border border-gray-200 px-3 text-sm bg-white"
                            >
                              <option value="">Select item...</option>
                              {rowItems.map((item) => (
                                <option key={item.id} value={item.id} disabled={usedItemIds.has(item.id) && row.itemId !== item.id}>
                                  {item.itemCode} - {item.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-500 text-center">
                            {selectedItem?.hsnCode || "—"}
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number" step="0.01" min="0"
                              value={row.taxRate || ""}
                              onChange={(e) => handleItemFieldChange(index, "taxRate", e.target.value)}
                              className="text-right h-9 w-full"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number" step="0.001" min="0"
                              value={row.quantity || ""}
                              onChange={(e) => handleItemFieldChange(index, "quantity", e.target.value)}
                              className="text-right h-9 w-full"
                            />
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-500">
                            {selectedItem?.unit || "—"}
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number" step="0.01" min="0"
                              value={row.rate || ""}
                              onChange={(e) => handleItemFieldChange(index, "rate", e.target.value)}
                              className="text-right h-9 w-full"
                            />
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-500 text-right">
                            {selectedItem ? Number(selectedItem.mrp).toFixed(2) : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number" step="0.01" min="0" max="100"
                              value={row.discountPercent || ""}
                              onChange={(e) => handleItemFieldChange(index, "discountPercent", e.target.value)}
                              className="text-right h-9 w-full"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              value={(row.amount + row.taxAmount).toFixed(2)}
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
            )}
          </div>

          {/* Row 3: Notes/Terms + Summary */}
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
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="h-4 w-4 text-gray-400" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Summary</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Sub Total</span>
                  <span className="font-medium">{totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">CGST</span>
                  <span>{totals.cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">SGST</span>
                  <span>{totals.sgst.toFixed(2)}</span>
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
                  <span className="text-teal-600">₹{totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function NewSalesInvoicePage() {
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
      <NewSalesInvoiceContent />
    </Suspense>
  );
}
