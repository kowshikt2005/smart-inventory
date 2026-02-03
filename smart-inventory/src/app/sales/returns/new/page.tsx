"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  // Fetch customers on mount
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await fetch("/api/customers?limit=1000");
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
          (ret: any) => ret.status === 'COMPLETED'
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
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/sales/returns")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Returns
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">New Sales Return</h1>
          <p className="text-gray-600">Record goods returned by customer</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Return Details */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Return Details</h2>

              <div className="space-y-4">
                {/* Customer Selection */}
                <div>
                  <Label htmlFor="customer">Customer *</Label>
                  <Select
                    value={selectedCustomerId}
                    onValueChange={(value) => {
                      setSelectedCustomerId(value);
                      setSelectedInvoiceId("");
                      setReturnItems([]);
                    }}
                    disabled={isLoadingCustomers}
                  >
                    <SelectTrigger id="customer">
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

                {/* Invoice Selection (Required) */}
                <div>
                  <Label htmlFor="invoice">Original Invoice *</Label>
                  <Select
                    value={selectedInvoiceId}
                    onValueChange={handleInvoiceChange}
                    disabled={!selectedCustomerId || isLoadingInvoices}
                  >
                    <SelectTrigger id="invoice">
                      <SelectValue placeholder="Select invoice..." />
                    </SelectTrigger>
                    <SelectContent>
                      {invoices.map((invoice) => (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.invoiceNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!selectedCustomerId && (
                    <p className="text-xs text-gray-500 mt-1">
                      Select a customer first to see their invoices
                    </p>
                  )}
                  {selectedCustomerId && invoices.length === 0 && !isLoadingInvoices && (
                    <p className="text-xs text-amber-600 mt-1">
                      No invoices found for this customer
                    </p>
                  )}
                  {selectedInvoiceId && (
                    <p className="text-xs text-gray-500 mt-1">
                      Items will be auto-loaded from the selected invoice
                    </p>
                  )}
                </div>

                {/* Return Date */}
                <div>
                  <Label htmlFor="returnDate">Return Date *</Label>
                  <Input
                    id="returnDate"
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                  />
                </div>

                {/* Reason */}
                <div>
                  <Label htmlFor="reason">Reason</Label>
                  <Textarea
                    id="reason"
                    placeholder="Reason for return..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Items Selected</span>
                  <span className="font-medium">{selectedCount} of {totalCount}</span>
                </div>
                <hr />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">CGST</span>
                  <span className="font-medium">{formatCurrency(cgst)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">SGST</span>
                  <span className="font-medium">{formatCurrency(sgst)}</span>
                </div>
                <hr />
                <div className="flex justify-between font-semibold">
                  <span>Total Amount</span>
                  <span className="text-lg">{formatCurrency(totalAmount)}</span>
                </div>
              </div>

              <Button
                onClick={handleSave}
                disabled={isSaving || selectedCount === 0}
                className="w-full mt-6 bg-teal-500 hover:bg-teal-600"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Return
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Return Items</h2>
                <div className="flex items-center gap-2">
                  {returnItems.length > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAll}
                      >
                        <CheckSquare className="h-4 w-4 mr-2" />
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDeselectAll}
                      >
                        <Square className="h-4 w-4 mr-2" />
                        Deselect All
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {isLoadingInvoiceItems ? (
                <div className="text-center py-12 text-gray-500">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading invoice items...
                </div>
              ) : returnItems.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {selectedInvoiceId ? (
                    "No items found in the selected invoice."
                  ) : (
                    "Select an invoice to load items for return."
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold w-[50px]">
                          Select
                        </TableHead>
                        <TableHead className="font-semibold w-[250px]">
                          Item
                        </TableHead>
                        <TableHead className="font-semibold">Unit</TableHead>
                        <TableHead className="font-semibold text-right">
                          Qty
                        </TableHead>
                        <TableHead className="font-semibold text-right">
                          Rate
                        </TableHead>
                        <TableHead className="font-semibold text-right">
                          Tax %
                        </TableHead>
                        <TableHead className="font-semibold text-right">
                          Amount
                        </TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returnItems.map((item) => (
                        <TableRow
                          key={item.id}
                          className={!item.selected ? "opacity-50 bg-gray-50" : ""}
                        >
                          <TableCell>
                            <Checkbox
                              checked={item.selected}
                              onCheckedChange={() => handleToggleItem(item.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.itemName}</div>
                              <div className="text-xs text-gray-500">{item.itemCode}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{item.unit}</TableCell>
                          <TableCell>
                            <div className="flex flex-col items-end gap-1">
                              <Input
                                type="number"
                                min="1"
                                max={item.maxQuantity > 0 ? item.maxQuantity : undefined}
                                step="1"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleItemChange(
                                    item.id,
                                    "quantity",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-20 text-right"
                                disabled={!item.selected}
                              />
                              {item.maxQuantity > 0 && (
                                <span className="text-xs text-gray-500">
                                  Max: {item.maxQuantity}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.rate}
                              onChange={(e) =>
                                handleItemChange(
                                  item.id,
                                  "rate",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-24 text-right"
                              disabled={!item.selected}
                            />
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {item.taxRate}%
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.amount + item.taxAmount)}
                          </TableCell>
                          <TableCell>
                            {/* Reserved for future actions */}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
