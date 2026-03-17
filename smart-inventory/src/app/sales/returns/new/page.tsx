"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Save, CheckSquare, Square } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Customer {
  id: string;
  customerNumber: string;
  name: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
}

interface InvoiceItem {
  id: string;
  itemId: string;
  item: {
    id: string;
    itemCode: string;
    name: string;
    unit: string;
    hsnCode: string | null;
    gstRate: number;
    sellingPrice: number;
  };
  quantity: number;
  rate: number;
  taxRate: number;
  taxAmount: number;
  amount: number;
}


interface ReturnItem {
  id: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  unit: string;
  quantity: number;
  maxQuantity: number; // Original invoice quantity (for validation)
  rate: number;
  taxRate: number;
  taxAmount: number;
  amount: number;
  selected: boolean;
}

export default function NewSalesReturnPage() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [returnDate, setReturnDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reason, setReason] = useState("");
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);

  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [isLoadingInvoiceItems, setIsLoadingInvoiceItems] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnNumber, setReturnNumber] = useState("Loading...");

  // Fetch next return number
  useEffect(() => {
    const fetchNextReturnNumber = async () => {
      try {
        const response = await fetch("/api/sales-returns/next-number");
        if (response.ok) {
          const data = await response.json();
          setReturnNumber(data.returnNumber);
        }
      } catch (err) {
        console.error("Error fetching next return number:", err);
      }
    };
    fetchNextReturnNumber();
  }, []);

  // Fetch customers on mount
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await fetch("/api/customers?limit=1000&activeOnly=true");
        if (response.ok) {
          const data = await response.json();
          setCustomers(data.customers || []);
        }
      } catch (err) {
        console.error("Error fetching customers:", err);
      } finally {
        setIsLoadingCustomers(false);
      }
    };
    fetchCustomers();
  }, []);

  // Fetch invoices when customer is selected
  useEffect(() => {
    if (!selectedCustomerId) {
      setInvoices([]);
      setSelectedInvoiceId("");
      return;
    }

    const fetchInvoices = async () => {
      try {
        setIsLoadingInvoices(true);
        const response = await fetch(
          `/api/sales-invoices?customerId=${selectedCustomerId}&limit=100`
        );
        if (response.ok) {
          const data = await response.json();
          setInvoices(data.invoices || []);
        }
      } catch (err) {
        console.error("Error fetching invoices:", err);
      } finally {
        setIsLoadingInvoices(false);
      }
    };
    fetchInvoices();
  }, [selectedCustomerId]);

  // Fetch invoice items when invoice is selected
  const fetchInvoiceItems = useCallback(async (invoiceId: string) => {
    if (!invoiceId) {
      setReturnItems([]);
      return;
    }

    try {
      setIsLoadingInvoiceItems(true);
      setError(null);
      const response = await fetch(`/api/sales-invoices/${invoiceId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch invoice (${response.status})`);
      }

      const invoice = await response.json();
      console.log("Fetched invoice:", invoice); // Debug log

      // Check if invoice already has a completed return
      if (invoice.salesReturns && invoice.salesReturns.length > 0) {
        const hasCompletedReturn = invoice.salesReturns.some(
          (ret: { status: string }) => ret.status === 'COMPLETED'
        );
        if (hasCompletedReturn) {
          throw new Error("This invoice already has a completed return and cannot be returned again.");
        }
      }

      const invoiceItems: InvoiceItem[] = invoice.items || [];
      console.log("Invoice items:", invoiceItems); // Debug log

      if (invoiceItems.length === 0) {
        setReturnItems([]);
        return;
      }

      // Auto-populate all items from the invoice
      const loadedItems: ReturnItem[] = invoiceItems
        .filter((invItem) => invItem && invItem.item) // Filter out any invalid items
        .map((invItem) => {
          const baseAmount = Number(invItem.quantity) * Number(invItem.rate);
          const taxAmount = baseAmount * (Number(invItem.taxRate) / 100);

          return {
            id: crypto.randomUUID(),
            itemId: invItem.item.id,
            itemName: invItem.item.name,
            itemCode: invItem.item.itemCode,
            unit: invItem.item.unit,
            quantity: Number(invItem.quantity),
            maxQuantity: Number(invItem.quantity), // Original quantity for validation
            rate: Number(invItem.rate),
            taxRate: Number(invItem.taxRate),
            taxAmount: taxAmount,
            amount: baseAmount,
            selected: true, // Selected by default
          };
        });

      console.log("Loaded return items:", loadedItems); // Debug log
      setReturnItems(loadedItems);
    } catch (err) {
      console.error("Error fetching invoice items:", err);
      setError(err instanceof Error ? err.message : "Failed to load invoice items");
      setReturnItems([]);
    } finally {
      setIsLoadingInvoiceItems(false);
    }
  }, []);

  // Handle invoice selection
  const handleInvoiceChange = (value: string) => {
    setSelectedInvoiceId(value);
    if (value) {
      fetchInvoiceItems(value);
    } else {
      setReturnItems([]);
    }
  };

  // Toggle item selection
  const handleToggleItem = (id: string) => {
    setReturnItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  // Select all items
  const handleSelectAll = () => {
    setReturnItems((prev) =>
      prev.map((item) => ({ ...item, selected: true }))
    );
  };

  // Deselect all items
  const handleDeselectAll = () => {
    setReturnItems((prev) =>
      prev.map((item) => ({ ...item, selected: false }))
    );
  };

  // Update item quantity or rate
  const handleItemChange = (
    id: string,
    field: keyof ReturnItem,
    value: string | number | boolean
  ) => {
    setReturnItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };

        // Validate quantity against max
        if (field === "quantity" && updated.maxQuantity > 0) {
          const newQty = Number(value);
          if (newQty > updated.maxQuantity) {
            updated.quantity = updated.maxQuantity;
          }
        }

        // Recalculate amounts
        const quantity = Number(updated.quantity) || 0;
        const rate = Number(updated.rate) || 0;
        const taxRate = Number(updated.taxRate) || 0;

        const baseAmount = quantity * rate;
        const taxAmount = baseAmount * (taxRate / 100);
        updated.amount = baseAmount;
        updated.taxAmount = taxAmount;

        return updated;
      })
    );
  };

  // Calculate totals (only for selected items)
  const selectedItems = returnItems.filter((item) => item.selected && item.itemId);
  const subtotal = selectedItems.reduce((sum, item) => sum + item.amount, 0);
  const totalTax = selectedItems.reduce((sum, item) => sum + item.taxAmount, 0);
  const cgst = totalTax / 2;
  const sgst = totalTax / 2;
  const totalAmount = subtotal + totalTax;

  // Count selected items
  const selectedCount = returnItems.filter((item) => item.selected).length;
  const totalCount = returnItems.length;

  // Save return
  const handleSave = async () => {
    if (!selectedCustomerId) {
      setError("Please select a customer");
      return;
    }

    if (!selectedInvoiceId) {
      setError("Please select an invoice");
      return;
    }

    // Filter only selected items with valid data
    const validItems = returnItems.filter(
      (item) => item.selected && item.itemId && item.quantity > 0 && item.rate > 0
    );

    if (validItems.length === 0) {
      setError("Please select at least one item with valid quantity and rate");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch("/api/sales-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          invoiceId: selectedInvoiceId,
          returnDate,
          reason: reason || null,
          items: validItems.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
            rate: item.rate,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create sales return");
      }

      router.push("/sales/returns");
    } catch (err) {
      console.error("Error creating sales return:", err);
      setError(
        err instanceof Error ? err.message : "Failed to create sales return"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Sticky action bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => router.push("/sales/returns")} className="text-gray-500 -ml-2">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div className="h-4 w-px bg-gray-200" />
              <div>
                <span className="text-base font-bold text-gray-900">New Sales Return</span>
                <span className="ml-2 text-sm text-gray-400">#{returnNumber}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => router.push("/sales/returns")}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving || selectedCount === 0} className="bg-teal-500 hover:bg-teal-600 text-white">
                {isSaving ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving...</>
                ) : (
                  <><Save className="h-4 w-4 mr-1.5" />Create Return</>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {/* Row 1: Return Details + Customer & Invoice */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Return Details</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Return Date <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Customer & Invoice <span className="text-red-400">*</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Customer</label>
                  <Select
                    value={selectedCustomerId}
                    onValueChange={(value) => {
                      setSelectedCustomerId(value);
                      setSelectedInvoiceId("");
                      setReturnItems([]);
                    }}
                    disabled={isLoadingCustomers}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer..." />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name} ({customer.customerNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Original Invoice</label>
                  <Select
                    value={selectedInvoiceId}
                    onValueChange={handleInvoiceChange}
                    disabled={!selectedCustomerId || isLoadingInvoices}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={!selectedCustomerId ? "Select customer first" : "Select invoice..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {invoices.map((invoice) => (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.invoiceNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCustomerId && invoices.length === 0 && !isLoadingInvoices && (
                    <p className="text-xs text-amber-600 mt-1">No invoices found for this customer</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">
                Return Items
                {returnItems.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    {selectedCount} of {totalCount} selected
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2">
                {returnItems.length > 0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleSelectAll} className="h-7 text-xs">
                      <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDeselectAll} className="h-7 text-xs">
                      <Square className="h-3.5 w-3.5 mr-1.5" />
                      Deselect All
                    </Button>
                  </>
                )}
              </div>
            </div>

            {isLoadingInvoiceItems ? (
              <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading invoice items...</span>
              </div>
            ) : returnItems.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
                {selectedInvoiceId
                  ? "No items found in the selected invoice."
                  : "Select a customer and invoice above to load items for return."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">Select</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">Unit</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Qty</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Rate ₹</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">Tax %</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnItems.map((item) => (
                      <tr
                        key={item.id}
                        className={`border-b border-gray-50 ${!item.selected ? "opacity-50 bg-gray-50" : "hover:bg-gray-50/50"}`}
                      >
                        <td className="px-3 py-2.5 text-center">
                          <Checkbox
                            checked={item.selected}
                            onCheckedChange={() => handleToggleItem(item.id)}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-sm text-gray-900">{item.itemName}</div>
                          <div className="text-xs text-gray-400">{item.itemCode}</div>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-gray-600">{item.unit}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col gap-0.5">
                            <Input
                              type="number"
                              min="1"
                              max={item.maxQuantity > 0 ? item.maxQuantity : undefined}
                              step="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(item.id, "quantity", parseFloat(e.target.value) || 0)
                              }
                              className="w-20 h-8 text-right"
                              disabled={!item.selected}
                            />
                            {item.maxQuantity > 0 && (
                              <span className="text-[10px] text-gray-400">Max: {item.maxQuantity}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.rate}
                            onChange={(e) =>
                              handleItemChange(item.id, "rate", parseFloat(e.target.value) || 0)
                            }
                            className="w-24 h-8 text-right"
                            disabled={!item.selected}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm text-gray-600">
                          {item.taxRate}%
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm font-medium text-gray-900">
                          {formatCurrency(item.amount + item.taxAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Row 2: Reason + Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Reason for Return</p>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for return..."
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Summary</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Items Selected</span>
                  <span className="font-medium">{selectedCount} of {totalCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Taxable Value</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">CGST</span>
                  <span>{formatCurrency(cgst)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">SGST</span>
                  <span>{formatCurrency(sgst)}</span>
                </div>
                <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span className="text-teal-600">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
