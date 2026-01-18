"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Save, Search, X } from "lucide-react";
import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { mutate } from "swr";

interface Vendor {
  id: string;
  vendorNumber: string;
  name: string;
}

interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  vendorId: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  vendor: Vendor;
}

interface BankAccount {
  id: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  balance: number;
  isActive: boolean;
}

const PAYMENT_MODES = [
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "OTHER", label: "Other" },
];

function NewVendorPaymentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const purchaseInvoiceId = searchParams.get("purchaseInvoiceId");

  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState<number>(0);
  const [mode, setMode] = useState("BANK_TRANSFER");
  const [paidFrom, setPaidFrom] = useState("Cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      setIsLoadingInvoices(true);
      const response = await fetch("/api/purchase-invoices?limit=500&status=PENDING");
      if (response.ok) {
        const data = await response.json();
        // Also fetch overdue invoices
        const overdueResponse = await fetch("/api/purchase-invoices?limit=500&status=OVERDUE");
        if (overdueResponse.ok) {
          const overdueData = await overdueResponse.json();
          setInvoices([...(data.purchaseInvoices || []), ...(overdueData.purchaseInvoices || [])]);
        } else {
          setInvoices(data.purchaseInvoices || []);
        }
      }
    } catch (err) {
      console.error("Error fetching invoices:", err);
    } finally {
      setIsLoadingInvoices(false);
    }
  }, []);

  const fetchBankAccounts = useCallback(async () => {
    try {
      setIsLoadingBanks(true);
      const response = await fetch("/api/bank-accounts?limit=100");
      if (response.ok) {
        const data = await response.json();
        setBankAccounts(data.bankAccounts || []);
      }
    } catch (err) {
      console.error("Error fetching bank accounts:", err);
    } finally {
      setIsLoadingBanks(false);
    }
  }, []);

  const loadInvoice = useCallback(async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/purchase-invoices/${invoiceId}`);
      if (response.ok) {
        const invoice = await response.json();
        setSelectedInvoice(invoice);
        setAmount(Number(invoice.balanceAmount));
      }
    } catch (err) {
      console.error("Error loading invoice:", err);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
    fetchBankAccounts();
    if (purchaseInvoiceId) {
      loadInvoice(purchaseInvoiceId);
    }
  }, [fetchInvoices, fetchBankAccounts, purchaseInvoiceId, loadInvoice]);

  const filteredInvoices = useMemo(() => {
    if (!invoiceSearch) return invoices;
    const search = invoiceSearch.toLowerCase();
    return invoices.filter(
      (i) =>
        i.invoiceNumber.toLowerCase().includes(search) ||
        i.vendor.name.toLowerCase().includes(search)
    );
  }, [invoices, invoiceSearch]);

  const handleSubmit = async () => {
    setError(null);

    if (!selectedInvoice) {
      setError("Please select an invoice");
      return;
    }

    if (!paymentDate) {
      setError("Please select a payment date");
      return;
    }

    if (!amount || amount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (amount > Number(selectedInvoice.balanceAmount)) {
      setError(`Amount cannot exceed balance of ${Number(selectedInvoice.balanceAmount).toFixed(2)}`);
      return;
    }

    if (!mode) {
      setError("Please select a payment mode");
      return;
    }

    if (!paidFrom) {
      setError("Please select payment source");
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        vendorId: selectedInvoice.vendorId,
        purchaseInvoiceId: selectedInvoice.id,
        date: paymentDate,
        amount,
        mode,
        paidFrom,
        reference: reference || null,
        notes: notes || null,
      };

      const response = await fetch("/api/vendor-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create payment");
      }

      mutate((key: string) => key.startsWith("/api/vendor-payments"));
      mutate((key: string) => key.startsWith("/api/purchase-invoices"));
      router.push("/purchases/payments");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/purchases/payments")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Payments
          </Button>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">New Vendor Payment</h1>
          <p className="text-gray-600">Record a payment to vendor</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
        )}

        <div className="space-y-6">
          {/* Invoice Selection */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Select Invoice *</h2>
            {selectedInvoice ? (
              <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedInvoice.invoiceNumber}</p>
                    <p className="text-sm text-gray-600">{selectedInvoice.vendor.name}</p>
                    <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Total</p>
                        <p className="font-medium">{formatCurrency(Number(selectedInvoice.totalAmount))}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Paid</p>
                        <p className="font-medium text-green-600">{formatCurrency(Number(selectedInvoice.paidAmount))}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Balance</p>
                        <p className="font-medium text-red-600">{formatCurrency(Number(selectedInvoice.balanceAmount))}</p>
                      </div>
                    </div>
                  </div>
                  {!purchaseInvoiceId && (
                    <Button variant="outline" size="sm" onClick={() => setSelectedInvoice(null)}>
                      <X className="h-4 w-4 mr-2" />
                      Change
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search invoices..."
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  {isLoadingInvoices ? (
                    <div className="flex items-center justify-center py-8 text-gray-500">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Loading invoices...
                    </div>
                  ) : filteredInvoices.length === 0 ? (
                    <div className="py-8 text-center text-gray-500">No unpaid invoices found</div>
                  ) : (
                    filteredInvoices.map((invoice) => (
                      <button
                        key={invoice.id}
                        onClick={() => {
                          setSelectedInvoice(invoice);
                          setAmount(Number(invoice.balanceAmount));
                        }}
                        className="w-full p-3 text-left hover:bg-gray-50 border-b last:border-b-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{invoice.invoiceNumber}</p>
                            <p className="text-sm text-gray-500">{invoice.vendor.name}</p>
                          </div>
                          <p className="font-medium text-red-600">{formatCurrency(Number(invoice.balanceAmount))}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Payment Details */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Payment Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount || ""}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode *</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paid From *</label>
                <select
                  value={paidFrom}
                  onChange={(e) => setPaidFrom(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="Cash">Cash</option>
                  {bankAccounts
                    .filter((b) => b.isActive)
                    .map((bank) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.accountName} ({bank.bankName}) - {formatCurrency(Number(bank.balance))}
                      </option>
                    ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference (Cheque/Transaction ID)</label>
                <Input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Enter reference number"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Notes</h2>
            <Textarea
              placeholder="Add any notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            <Button variant="outline" onClick={() => router.push("/purchases/payments")}>
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
                  Processing...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Record Payment
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function NewVendorPaymentPage() {
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
      <NewVendorPaymentPageContent />
    </Suspense>
  );
}
