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
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Customer {
  id: string;
  customerNumber: string;
  name: string;
}

interface PendingInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  orderNumber: string | null;
  dueDate: string | null;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  effectiveStatus: string;
}

interface Allocation {
  invoiceId: string;
  amount: number;
}

const PAYMENT_MODES = [
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "OTHER", label: "Other" },
];

function NewPaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomerId = searchParams.get("customerId");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    preselectedCustomerId || ""
  );
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  // Bank account & cheque tracking
  const [bankAccounts, setBankAccounts] = useState<{ id: string; accountName: string; bankName: string; currentBalance: number }[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("");
  const [chequeCollected, setChequeCollected] = useState(false);
  const [chequeCollectedDate, setChequeCollectedDate] = useState("");

  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentNumber, setPaymentNumber] = useState("Loading...");

  // Fetch next payment number
  useEffect(() => {
    const fetchNextPaymentNumber = async () => {
      try {
        const response = await fetch("/api/payments/next-number");
        if (response.ok) {
          const data = await response.json();
          setPaymentNumber(data.paymentNumber);
        }
      } catch (err) {
        console.error("Error fetching next payment number:", err);
      }
    };
    fetchNextPaymentNumber();
  }, []);

  // Fetch bank accounts
  useEffect(() => {
    const fetchBankAccounts = async () => {
      try {
        const response = await fetch("/api/bank-accounts?activeOnly=true");
        if (response.ok) {
          const data = await response.json();
          setBankAccounts(data.bankAccounts || []);
        }
      } catch (err) {
        console.error("Error fetching bank accounts:", err);
      }
    };
    fetchBankAccounts();
  }, []);

  // Fetch customers
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await fetch("/api/customers?limit=1000");
        if (!response.ok) throw new Error("Failed to fetch customers");
        const data = await response.json();
        setCustomers(data.customers || []);
      } catch (err) {
        console.error("Error fetching customers:", err);
      } finally {
        setIsLoadingCustomers(false);
      }
    };
    fetchCustomers();
  }, []);

  // Fetch pending invoices when customer is selected
  const fetchPendingInvoices = useCallback(async () => {
    if (!selectedCustomerId) {
      setPendingInvoices([]);
      setAllocations({});
      return;
    }

    try {
      setIsLoadingInvoices(true);
      setError(null);

      const response = await fetch(
        `/api/customers/${selectedCustomerId}/pending-invoices`
      );
      if (!response.ok) throw new Error("Failed to fetch pending invoices");

      const data = await response.json();
      setPendingInvoices(data.invoices || []);
      setAllocations({});
    } catch (err) {
      console.error("Error fetching pending invoices:", err);
      setError("Failed to load pending invoices");
    } finally {
      setIsLoadingInvoices(false);
    }
  }, [selectedCustomerId]);

  useEffect(() => {
    fetchPendingInvoices();
  }, [fetchPendingInvoices]);

  // Calculate totals
  const totalAllocated = Object.values(allocations).reduce(
    (sum, amt) => sum + (amt || 0),
    0
  );
  const totalPending = pendingInvoices.reduce(
    (sum, inv) => sum + Number(inv.balanceAmount),
    0
  );

  // Handle allocation change
  const handleAllocationChange = (invoiceId: string, value: string) => {
    const amount = parseFloat(value) || 0;
    const invoice = pendingInvoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;

    // Cap at balance amount
    const maxAmount = Number(invoice.balanceAmount);
    const validAmount = Math.min(Math.max(0, amount), maxAmount);

    setAllocations((prev) => ({
      ...prev,
      [invoiceId]: validAmount,
    }));
  };

  // Auto-allocate full amount
  const handleAllocateFull = (invoiceId: string) => {
    const invoice = pendingInvoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;

    setAllocations((prev) => ({
      ...prev,
      [invoiceId]: Number(invoice.balanceAmount),
    }));
  };

  // Clear all allocations
  const handleClearAllocations = () => {
    setAllocations({});
  };

  // Save payment
  const handleSave = async () => {
    if (!selectedCustomerId) {
      setError("Please select a customer");
      return;
    }

    if (totalAllocated <= 0) {
      setError("Please allocate payment to at least one invoice");
      return;
    }

    // Build allocations array
    const allocationsList: Allocation[] = Object.entries(allocations)
      .filter(([, amount]) => amount > 0)
      .map(([invoiceId, amount]) => ({ invoiceId, amount }));

    if (allocationsList.length === 0) {
      setError("Please allocate payment to at least one invoice");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          amount: totalAllocated,
          paymentDate,
          mode: paymentMode,
          referenceNumber: referenceNumber || null,
          notes: notes || null,
          bankAccountId: selectedBankAccountId || null,
          chequeCollected,
          chequeCollectedDate: chequeCollectedDate || null,
          allocations: allocationsList,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create payment");
      }

      router.push("/sales/receipts");
    } catch (err) {
      console.error("Error creating payment:", err);
      setError(err instanceof Error ? err.message : "Failed to create payment");
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

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/sales/receipts")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Payments
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Record Payment</h1>
          <p className="text-sm text-gray-600">
            Receipt #: {paymentNumber}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Payment Details */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Payment Details</h2>

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

                {/* Payment Date */}
                <div>
                  <Label htmlFor="paymentDate">Payment Date *</Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>

                {/* Payment Mode */}
                <div>
                  <Label htmlFor="paymentMode">Payment Mode *</Label>
                  <Select value={paymentMode} onValueChange={setPaymentMode}>
                    <SelectTrigger id="paymentMode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>
                          {mode.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Deposit To (Bank Account) */}
                <div>
                  <Label htmlFor="bankAccount">Deposit To</Label>
                  <Select value={selectedBankAccountId} onValueChange={setSelectedBankAccountId}>
                    <SelectTrigger id="bankAccount">
                      <SelectValue placeholder="Select account..." />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.accountName} ({acc.bankName})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Reference Number */}
                <div>
                  <Label htmlFor="referenceNumber">Reference Number</Label>
                  <Input
                    id="referenceNumber"
                    type="text"
                    placeholder="Cheque #, Transaction ID..."
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                  />
                </div>

                {/* Cheque Collection Tracking */}
                {paymentMode === "CHEQUE" && (
                  <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id="chequeCollected"
                        checked={chequeCollected}
                        onChange={(e) => {
                          setChequeCollected(e.target.checked);
                          if (!e.target.checked) setChequeCollectedDate("");
                        }}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="chequeCollected" className="text-amber-800 font-medium cursor-pointer">
                        Cheque Collected
                      </Label>
                    </div>
                    {chequeCollected && (
                      <div className="mt-2">
                        <Label htmlFor="chequeCollectedDate" className="text-amber-700 text-sm">
                          Collection Date
                        </Label>
                        <Input
                          id="chequeCollectedDate"
                          type="date"
                          value={chequeCollectedDate}
                          onChange={(e) => setChequeCollectedDate(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Optional notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Pending</span>
                  <span className="font-medium">
                    {formatCurrency(totalPending)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Allocated</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(totalAllocated)}
                  </span>
                </div>
                <hr />
                <div className="flex justify-between font-semibold">
                  <span>Payment Amount</span>
                  <span className="text-lg text-green-600">
                    {formatCurrency(totalAllocated)}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleSave}
                disabled={isSaving || totalAllocated <= 0}
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
                    Save Payment
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Invoice Allocation */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Allocate to Invoices</h2>
                {Object.keys(allocations).length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearAllocations}
                  >
                    Clear All
                  </Button>
                )}
              </div>

              {!selectedCustomerId ? (
                <div className="text-center py-12 text-gray-500">
                  Select a customer to see pending invoices
                </div>
              ) : isLoadingInvoices ? (
                <div className="text-center py-12 text-gray-500">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading invoices...
                </div>
              ) : pendingInvoices.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No pending invoices for this customer
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Invoice</TableHead>
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Due</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold text-right">
                          Total
                        </TableHead>
                        <TableHead className="font-semibold text-right">
                          Balance
                        </TableHead>
                        <TableHead className="font-semibold text-right">
                          Allocate
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingInvoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {invoice.invoiceNumber}
                              </p>
                              {invoice.orderNumber && (
                                <p className="text-xs text-gray-500">
                                  Order: {invoice.orderNumber}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(invoice.invoiceDate)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(invoice.dueDate)}
                          </TableCell>
                          <TableCell>
                            <InvoiceStatusBadge
                              status={invoice.effectiveStatus}
                            />
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatCurrency(Number(invoice.totalAmount))}
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-600">
                            {formatCurrency(Number(invoice.balanceAmount))}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <Input
                                type="number"
                                min="0"
                                max={Number(invoice.balanceAmount)}
                                step="0.01"
                                value={allocations[invoice.id] || ""}
                                onChange={(e) =>
                                  handleAllocationChange(
                                    invoice.id,
                                    e.target.value
                                  )
                                }
                                className="w-28 text-right"
                                placeholder="0.00"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAllocateFull(invoice.id)}
                                title="Allocate full balance"
                              >
                                Full
                              </Button>
                            </div>
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

export default function NewPaymentPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        </div>
      </DashboardLayout>
    }>
      <NewPaymentContent />
    </Suspense>
  );
}
