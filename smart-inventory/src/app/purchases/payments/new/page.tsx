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
  gstin: string | null;
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
  currentBalance: number;
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

  // Payment type: 'invoice' or 'advance'
  const [paymentType, setPaymentType] = useState<"invoice" | "advance">(
    purchaseInvoiceId ? "invoice" : "invoice"
  );

  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState<number>(0);
  const [mode, setMode] = useState("BANK_TRANSFER");
  const [paidFrom, setPaidFrom] = useState("Cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  // For invoice payments
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  // For advance payments
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorSearch, setVendorSearch] = useState("");
  const [, setIsLoadingVendors] = useState(false);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [, setIsLoadingBanks] = useState(false);

  // Cheque tracking
  const [chequeCollected, setChequeCollected] = useState(false);
  const [chequeCollectedDate, setChequeCollectedDate] = useState("");

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
    fetchVendors();
    fetchBankAccounts();
    if (purchaseInvoiceId) {
      loadInvoice(purchaseInvoiceId);
    }
  }, [fetchInvoices, fetchVendors, fetchBankAccounts, purchaseInvoiceId, loadInvoice]);

  const filteredInvoices = useMemo(() => {
    if (!invoiceSearch) return invoices;
    const search = invoiceSearch.toLowerCase();
    return invoices.filter(
      (i) =>
        i.invoiceNumber.toLowerCase().includes(search) ||
        i.vendor.name.toLowerCase().includes(search)
    );
  }, [invoices, invoiceSearch]);

  const filteredVendors = useMemo(() => {
    if (!vendorSearch) return vendors;
    const search = vendorSearch.toLowerCase();
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(search) ||
        v.vendorNumber.toLowerCase().includes(search) ||
        (v.gstin && v.gstin.toLowerCase().includes(search))
    );
  }, [vendors, vendorSearch]);

  const handlePaymentTypeChange = (type: "invoice" | "advance") => {
    setPaymentType(type);
    setSelectedInvoice(null);
    setSelectedVendor(null);
    setAmount(0);
  };

  const handleSubmit = async () => {
    setError(null);

    // Validation for invoice payment
    if (paymentType === "invoice") {
      if (!selectedInvoice) {
        setError("Please select an invoice");
        return;
      }

      if (amount > Number(selectedInvoice.balanceAmount)) {
        setError(`Amount cannot exceed balance of ${Number(selectedInvoice.balanceAmount).toFixed(2)}`);
        return;
      }
    }

    // Validation for advance payment
    if (paymentType === "advance") {
      if (!selectedVendor) {
        setError("Please select a vendor");
        return;
      }
    }

    if (!paymentDate) {
      setError("Please select a payment date");
      return;
    }

    if (!amount || amount <= 0) {
      setError("Please enter a valid amount");
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

      const payload: {
        vendorId: string;
        purchaseInvoiceId?: string;
        date: string;
        amount: number;
        mode: string;
        paidFrom: string;
        reference: string | null;
        notes: string | null;
        chequeCollected: boolean;
        chequeCollectedDate: string | null;
      } = {
        vendorId: paymentType === "invoice" ? selectedInvoice!.vendorId : selectedVendor!.id,
        date: paymentDate,
        amount,
        mode,
        paidFrom,
        reference: reference || null,
        notes: notes || null,
        chequeCollected,
        chequeCollectedDate: chequeCollectedDate || null,
      };

      // Only include purchaseInvoiceId for invoice payments
      if (paymentType === "invoice" && selectedInvoice) {
        payload.purchaseInvoiceId = selectedInvoice.id;
      }

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
      <div className="min-h-screen bg-gray-50">
        {/* Sticky action bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => router.push("/purchases/payments")} className="text-gray-500 -ml-2">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div className="h-4 w-px bg-gray-200" />
              <div>
                <span className="text-base font-bold text-gray-900">New Vendor Payment</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => router.push("/purchases/payments")}>Cancel</Button>
              <Button size="sm" onClick={handleSubmit} disabled={isSubmitting} className="bg-teal-500 hover:bg-teal-600 text-white">
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Processing...</>
                ) : (
                  <><Save className="h-4 w-4 mr-1.5" />Record Payment</>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {/* Payment Type Selection */}
          {!purchaseInvoiceId && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Payment Type</p>
              <div className="flex gap-3">
                <button
                  onClick={() => handlePaymentTypeChange("invoice")}
                  className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                    paymentType === "invoice"
                      ? "border-teal-500 bg-teal-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-medium text-sm">Invoice Payment</p>
                  <p className="text-xs text-gray-500">Pay against a specific invoice</p>
                </button>
                <button
                  onClick={() => handlePaymentTypeChange("advance")}
                  className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                    paymentType === "advance"
                      ? "border-teal-500 bg-teal-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-medium text-sm">Advance Payment</p>
                  <p className="text-xs text-gray-500">Pay vendor without specific invoice</p>
                </button>
              </div>
            </div>
          )}

          {/* Row 1: Payment Details + Invoice/Vendor Selection */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Payment Details</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Payment Date <span className="text-red-500">*</span>
                  </label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} max={new Date().toISOString().split("T")[0]} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Amount <span className="text-red-500">*</span>
                  </label>
                  <Input type="number" min="0" step="0.01" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Payment Mode <span className="text-red-500">*</span>
                  </label>
                  <select value={mode} onChange={(e) => setMode(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
                    {PAYMENT_MODES.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Paid From <span className="text-red-500">*</span>
                  </label>
                  <select value={paidFrom} onChange={(e) => setPaidFrom(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
                    <option value="Cash">Cash</option>
                    {bankAccounts.filter((b) => b.isActive).map((bank) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.accountName} ({bank.bankName}) - {formatCurrency(Number(bank.currentBalance))}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Reference</label>
                  <Input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque/Transaction ID" />
                </div>
              </div>
            </div>

            <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 p-5">
              {/* Invoice Selection */}
              {paymentType === "invoice" && (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                    Select Invoice <span className="text-red-400">*</span>
                  </p>
                  {selectedInvoice ? (
                    <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{selectedInvoice.invoiceNumber}</p>
                          <p className="text-xs text-gray-600">{selectedInvoice.vendor.name}</p>
                          <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
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
                          <Button variant="outline" size="sm" onClick={() => setSelectedInvoice(null)} className="h-7 text-xs">
                            <X className="h-3.5 w-3.5 mr-1" />
                            Change
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input type="text" placeholder="Search invoices..." value={invoiceSearch} onChange={(e) => setInvoiceSearch(e.target.value)} className="pl-9" />
                      </div>
                      <div className="border rounded-lg max-h-48 overflow-y-auto">
                        {isLoadingInvoices ? (
                          <div className="flex items-center justify-center py-6 text-gray-500">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            <span className="text-sm">Loading invoices...</span>
                          </div>
                        ) : filteredInvoices.length === 0 ? (
                          <p className="p-3 text-gray-500 text-sm text-center">No unpaid invoices found</p>
                        ) : (
                          filteredInvoices.map((invoice) => (
                            <button
                              key={invoice.id}
                              onClick={() => { setSelectedInvoice(invoice); setAmount(Number(invoice.balanceAmount)); }}
                              className="w-full p-3 text-left hover:bg-gray-50 border-b last:border-b-0"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-sm">{invoice.invoiceNumber}</p>
                                  <p className="text-xs text-gray-500">{invoice.vendor.name}</p>
                                </div>
                                <p className="font-medium text-sm text-red-600">{formatCurrency(Number(invoice.balanceAmount))}</p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Vendor Selection (advance) */}
              {paymentType === "advance" && (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                    Select Vendor <span className="text-red-400">*</span>
                  </p>
                  {selectedVendor ? (
                    <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{selectedVendor.name}</p>
                          <p className="text-xs text-gray-600">
                            {selectedVendor.vendorNumber}
                            {selectedVendor.gstin && ` | GSTIN: ${selectedVendor.gstin}`}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setSelectedVendor(null)} className="h-7 text-xs">
                          <X className="h-3.5 w-3.5 mr-1" />
                          Change
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input type="text" placeholder="Search vendors..." value={vendorSearch} onChange={(e) => setVendorSearch(e.target.value)} className="pl-9" />
                      </div>
                      <div className="border rounded-lg max-h-48 overflow-y-auto">
                        {filteredVendors.length === 0 ? (
                          <p className="p-3 text-gray-500 text-sm text-center">No vendors found</p>
                        ) : (
                          filteredVendors.map((vendor) => (
                            <button
                              key={vendor.id}
                              onClick={() => setSelectedVendor(vendor)}
                              className="w-full p-3 text-left hover:bg-gray-50 border-b last:border-b-0"
                            >
                              <p className="font-medium text-sm">{vendor.name}</p>
                              <p className="text-xs text-gray-500">
                                {vendor.vendorNumber}
                                {vendor.gstin && ` | ${vendor.gstin}`}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Cheque Collection Tracking */}
              {mode === "CHEQUE" && (
                <div className="mt-4 border border-amber-200 bg-amber-50 rounded-lg p-4">
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

          {/* Notes + Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Notes</p>
                <Textarea placeholder="Add any notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="resize-none" />
              </div>
            </div>
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Summary</p>
              <div className="space-y-2 text-sm">
                {paymentType === "invoice" && selectedInvoice && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Invoice Balance</span>
                      <span className="font-medium text-red-600">{formatCurrency(Number(selectedInvoice.balanceAmount))}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
                  <span>Payment Amount</span>
                  <span className="text-teal-600">{formatCurrency(amount)}</span>
                </div>
              </div>
            </div>
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
