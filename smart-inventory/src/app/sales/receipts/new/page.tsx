"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
        const response = await fetch("/api/customers?limit=1000&activeOnly=true");
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
      <div className="min-h-screen bg-gray-50">
        {/* Sticky action bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => router.push("/sales/receipts")} className="text-gray-500 -ml-2">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div className="h-4 w-px bg-gray-200" />
              <div>
                <span className="text-base font-bold text-gray-900">Record Payment</span>
                <span className="ml-2 text-sm text-gray-400">#{paymentNumber}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => router.push("/sales/receipts")}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving || totalAllocated <= 0} className="bg-teal-500 hover:bg-teal-600 text-white">
                {isSaving ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving...</>
                ) : (
                  <><Save className="h-4 w-4 mr-1.5" />Save Payment</>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {/* Row 1: Payment Date/Ref + Customer & Method */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Payment Details</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Payment Date <span className="text-red-500">*</span>
                  </label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Reference Number</label>
                  <Input type="text" placeholder="Cheque #, Transaction ID..." value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Customer & Method <span className="text-red-400">*</span>
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Customer</label>
                  <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId} disabled={isLoadingCustomers}>
                    <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name} ({customer.customerNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Payment Mode <span className="text-red-500">*</span>
                    </label>
                    <Select value={paymentMode} onValueChange={setPaymentMode}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_MODES.map((mode) => (
                          <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Deposit To</label>
                    <Select value={selectedBankAccountId} onValueChange={setSelectedBankAccountId}>
                      <SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.accountName} ({acc.bankName})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Cheque Collection Tracking */}
                {paymentMode === "CHEQUE" && (
                  <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
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
                      <label htmlFor="chequeCollected" className="text-amber-800 font-medium cursor-pointer text-sm">
                        Cheque Collected
                      </label>
                    </div>
                    {chequeCollected && (
                      <div className="mt-2">
                        <label className="block text-sm text-amber-700 mb-1">Collection Date</label>
                        <Input type="date" value={chequeCollectedDate} onChange={(e) => setChequeCollectedDate(e.target.value)} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Invoice Allocation Section */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Allocate to Invoices</p>
              {Object.keys(allocations).length > 0 && (
                <Button variant="outline" size="sm" onClick={handleClearAllocations} className="h-7 text-xs">
                  Clear All
                </Button>
              )}
            </div>

            {!selectedCustomerId ? (
              <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
                Select a customer to see pending invoices
              </div>
            ) : isLoadingInvoices ? (
              <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading invoices...</span>
              </div>
            ) : pendingInvoices.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
                No pending invoices for this customer
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Date</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Due</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Status</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Total</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Balance</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">Allocate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingInvoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-sm text-gray-900">{invoice.invoiceNumber}</div>
                          {invoice.orderNumber && (
                            <div className="text-xs text-gray-400">Order: {invoice.orderNumber}</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-gray-600">{formatDate(invoice.invoiceDate)}</td>
                        <td className="px-3 py-2.5 text-sm text-gray-600">{formatDate(invoice.dueDate)}</td>
                        <td className="px-3 py-2.5">
                          <InvoiceStatusBadge status={invoice.effectiveStatus} />
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm text-gray-600">
                          {formatCurrency(Number(invoice.totalAmount))}
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm font-medium text-red-600">
                          {formatCurrency(Number(invoice.balanceAmount))}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <Input
                              type="number"
                              min="0"
                              max={Number(invoice.balanceAmount)}
                              step="0.01"
                              value={allocations[invoice.id] || ""}
                              onChange={(e) => handleAllocationChange(invoice.id, e.target.value)}
                              className="w-28 h-8 text-right"
                              placeholder="0.00"
                            />
                            <Button variant="outline" size="sm" onClick={() => handleAllocateFull(invoice.id)} title="Allocate full balance" className="h-8 text-xs">
                              Full
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Row 2: Notes + Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Notes</p>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." rows={3} className="resize-none" />
              </div>
            </div>
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Pending</span>
                  <span className="font-medium">{formatCurrency(totalPending)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Allocated</span>
                  <span className="font-medium text-green-600">{formatCurrency(totalAllocated)}</span>
                </div>
                <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
                  <span>Payment Amount</span>
                  <span className="text-teal-600">{formatCurrency(totalAllocated)}</span>
                </div>
              </div>
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
