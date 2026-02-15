"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PurchaseOrderItemRow } from "@/components/purchase-orders/PurchaseOrderItemRow";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Save,
  Search,
  X,
  Calculator,
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
      }
    }
  }, [
    editId,
    loadInvoiceForEdit,
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
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/purchases/invoices")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Invoices
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {editId ? "Edit Purchase Invoice" : "New Purchase Invoice"}
              </h1>
              <p className="text-sm text-gray-600">
                Invoice #: {invoiceNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/purchases/invoices")}
            >
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
                  {editId ? "Update Invoice" : "Create Invoice"}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Form */}
        <div className="space-y-6">
          {/* Invoice Details */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Invoice Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              {/* Vendor Selection */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vendor <span className="text-red-500">*</span>
                </label>
                {isLoadingVendors ? (
                  <div className="flex items-center gap-2 text-gray-500 p-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading vendors...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {!selectedVendor && (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="Search vendors by name, number, or GSTIN..."
                          value={vendorSearch}
                          onChange={(e) => setVendorSearch(e.target.value)}
                          className="pl-10"
                        />
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
                        {!purchaseOrderId && (
                          <button
                            type="button"
                            onClick={() => setSelectedVendor(null)}
                            className="text-teal-600 hover:text-teal-800"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Invoice Items
            </h2>
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
                        <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">
                          Item
                        </th>
                        <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">
                          HSN
                        </th>
                        <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">
                          Qty
                        </th>
                        <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">
                          Unit
                        </th>
                        <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">
                          Rate
                        </th>
                        <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700">
                          GST %
                        </th>
                        <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700">
                          Tax Amt
                        </th>
                        <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700">
                          Total
                        </th>
                        <th className="px-3 py-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceItems.map((item, index) => (
                        <PurchaseOrderItemRow
                          key={item.id}
                          item={item}
                          items={items}
                          selectedItemIds={selectedItemIds}
                          onUpdate={(updatedItem) =>
                            handleUpdateItem(index, updatedItem)
                          }
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

          {/* Notes and Terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes about this invoice..."
                rows={3}
              />
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Terms & Conditions
              </label>
              <Textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Terms and conditions..."
                rows={3}
              />
            </div>
          </div>

          {/* Summary Panel */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex justify-end">
              <div className="w-full max-w-sm space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <Calculator className="h-5 w-5 text-gray-500" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Invoice Summary
                  </h3>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Taxable Value</span>
                  <span className="font-medium">
                    {formatCurrency(totals.subtotal)}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">CGST</span>
                  <span>{formatCurrency(totals.cgst)}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">SGST</span>
                  <span>{formatCurrency(totals.sgst)}</span>
                </div>

                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-600">Round Off</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="-1"
                    max="1"
                    value={roundOff}
                    onChange={(e) =>
                      setRoundOff(parseFloat(e.target.value) || 0)
                    }
                    className="w-24 text-right h-8"
                  />
                </div>

                <div className="border-t pt-3">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold text-gray-900">
                      Total
                    </span>
                    <span className="text-lg font-bold text-teal-600">
                      {formatCurrency(totals.totalAmount)}
                    </span>
                  </div>
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
