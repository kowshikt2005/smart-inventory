"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
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

interface Item {
  id: string;
  itemCode: string;
  name: string;
  unit: string;
  gstRate: number;
  standardPrice: number;
}

interface ReturnItem {
  id: string;
  itemId: string;
  itemName: string;
  unit: string;
  quantity: number;
  rate: number;
  taxRate: number;
  taxAmount: number;
  amount: number;
}

export default function NewSalesReturnPage() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [returnDate, setReturnDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reason, setReason] = useState("");
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);

  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch customers and items on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [customersRes, itemsRes] = await Promise.all([
          fetch("/api/customers?limit=1000"),
          fetch("/api/items?limit=1000"),
        ]);

        if (customersRes.ok) {
          const customersData = await customersRes.json();
          setCustomers(customersData.customers || []);
        }

        if (itemsRes.ok) {
          const itemsData = await itemsRes.json();
          setItems(itemsData.items || []);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setIsLoadingCustomers(false);
        setIsLoadingItems(false);
      }
    };
    fetchData();
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

  // Add item to return
  const handleAddItem = () => {
    setReturnItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        itemId: "",
        itemName: "",
        unit: "",
        quantity: 1,
        rate: 0,
        taxRate: 0,
        taxAmount: 0,
        amount: 0,
      },
    ]);
  };

  // Remove item from return
  const handleRemoveItem = (id: string) => {
    setReturnItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Update item
  const handleItemChange = (
    id: string,
    field: keyof ReturnItem,
    value: string | number
  ) => {
    setReturnItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };

        // If item selection changed, update item details
        if (field === "itemId") {
          const selectedItem = items.find((i) => i.id === value);
          if (selectedItem) {
            updated.itemName = selectedItem.name;
            updated.unit = selectedItem.unit;
            updated.rate = Number(selectedItem.standardPrice);
            updated.taxRate = Number(selectedItem.gstRate);
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

  // Calculate totals
  const subtotal = returnItems.reduce((sum, item) => sum + item.amount, 0);
  const totalTax = returnItems.reduce((sum, item) => sum + item.taxAmount, 0);
  const cgst = totalTax / 2;
  const sgst = totalTax / 2;
  const totalAmount = subtotal + totalTax;

  // Save return
  const handleSave = async () => {
    if (!selectedCustomerId) {
      setError("Please select a customer");
      return;
    }

    if (returnItems.length === 0) {
      setError("Please add at least one item");
      return;
    }

    const validItems = returnItems.filter(
      (item) => item.itemId && item.quantity > 0 && item.rate > 0
    );

    if (validItems.length === 0) {
      setError("Please fill in item details");
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
          invoiceId: selectedInvoiceId || null,
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
                    onValueChange={setSelectedCustomerId}
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

                {/* Invoice Selection (Optional) */}
                <div>
                  <Label htmlFor="invoice">Original Invoice (Optional)</Label>
                  <Select
                    value={selectedInvoiceId}
                    onValueChange={(value) => setSelectedInvoiceId(value === "none" ? "" : value)}
                    disabled={!selectedCustomerId || isLoadingInvoices}
                  >
                    <SelectTrigger id="invoice">
                      <SelectValue placeholder="Select invoice..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {invoices.map((invoice) => (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.invoiceNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                disabled={isSaving || returnItems.length === 0}
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  disabled={isLoadingItems}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {returnItems.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No items added. Click &quot;Add Item&quot; to add items to return.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
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
                        <TableRow key={item.id}>
                          <TableCell>
                            <Select
                              value={item.itemId}
                              onValueChange={(value) =>
                                handleItemChange(item.id, "itemId", value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select item..." />
                              </SelectTrigger>
                              <SelectContent>
                                {items.map((i) => (
                                  <SelectItem key={i.id} value={i.id}>
                                    {i.name} ({i.itemCode})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-sm">{item.unit}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0.001"
                              step="0.001"
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(
                                  item.id,
                                  "quantity",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-20 text-right"
                            />
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
                            />
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {item.taxRate}%
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.amount + item.taxAmount)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(item.id)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
