"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { ArrowLeft, Loader2, Ban, Printer } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

interface Customer {
  id: string;
  customerNumber: string;
  name: string;
  gstin: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  creditDays: number;
}

interface InvoiceItem {
  id: string;
  itemId: string;
  quantity: number;
  rate: number;
  discountPercent: number;
  taxRate: number;
  taxAmount: number;
  amount: number;
  item: {
    id: string;
    itemCode: string;
    name: string;
    unit: string;
    hsnCode: string | null;
    gstRate: number;
  };
}

interface PaymentAllocation {
  id: string;
  amount: number;
  payment: {
    id: string;
    paymentNumber: string;
    paymentDate: string;
    amount: number;
    mode: string;
  };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  subtotal: number;
  cgst: number;
  sgst: number;
  taxAmount: number;
  roundOff: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: string;
  effectiveStatus: string;
  notes: string | null;
  customer: Customer;
  items: InvoiceItem[];
  allocations: PaymentAllocation[];
}

export default function DummyInvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/sales-invoices/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Invoice not found");
        return res.json();
      })
      .then((data) => setInvoice(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load invoice"))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this invoice? Stock will be restored.")) return;
    try {
      const res = await fetch(`/api/sales-invoices/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel");
      }
      router.push("/sales/dummy-invoices");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel invoice");
    }
  };

  const handlePrint = () => window.print();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(amount);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !invoice) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error || "Invoice not found"}</div>
          <Button onClick={() => router.push("/sales/dummy-invoices")} variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Print styles — hide sidebar and nav chrome */}
      <style>{`
        @media print {
          aside { display: none !important; }
          .print-hide { display: none !important; }
          .print-invoice { margin-left: 0 !important; padding: 24px !important; }
          .print-invoice > div { box-shadow: none !important; }
          body { font-size: 13px; }
        }
      `}</style>

      <div className="print-invoice p-6 max-w-5xl mx-auto">
        {/* Non-print header */}
        <div className="print-hide mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/sales/dummy-invoices")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dummy Invoices
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{invoice.invoiceNumber}</h1>
              <p className="text-sm text-gray-500">Dummy Invoice</p>
            </div>
            <div className="flex items-center gap-2">
              <InvoiceStatusBadge status={invoice.effectiveStatus} />
              <Button onClick={handlePrint} variant="outline" className="flex items-center gap-2">
                <Printer className="h-4 w-4" />
                Print
              </Button>
              {invoice.effectiveStatus !== "PAID" && invoice.effectiveStatus !== "CANCELLED" && (
                <Button onClick={handleCancel} variant="outline" className="text-red-600 border-red-600 hover:bg-red-50">
                  <Ban className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Print-only header */}
        <div className="hidden" style={{ WebkitPrintColorAdjust: "exact" }}>
          <style>{`@media print { .print-header { display: block !important; text-align: center; margin-bottom: 24px; } }`}</style>
        </div>
        <div className="print-header" style={{ display: "none" }}>
          <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>INVOICE</h1>
          <p style={{ fontSize: "18px", color: "#555" }}>{invoice.invoiceNumber}</p>
          <p style={{ fontSize: "13px", color: "#888" }}>Dummy Invoice</p>
        </div>

        {/* Customer + Invoice Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Bill To</h2>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-gray-600">Name</p>
                <p className="font-medium">{invoice.customer.name}</p>
              </div>
              <div>
                <p className="text-gray-600">Customer #</p>
                <p className="font-medium">{invoice.customer.customerNumber}</p>
              </div>
              {invoice.customer.gstin && (
                <div>
                  <p className="text-gray-600">GSTIN</p>
                  <p className="font-medium">{invoice.customer.gstin}</p>
                </div>
              )}
              {invoice.customer.address && (
                <div>
                  <p className="text-gray-600">Address</p>
                  <p className="font-medium">{invoice.customer.address}</p>
                  <p className="text-gray-500">
                    {invoice.customer.city}, {invoice.customer.state} – {invoice.customer.pincode}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Invoice Details</h2>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-gray-600">Invoice Date</p>
                <p className="font-medium">{formatDate(invoice.invoiceDate)}</p>
              </div>
              <div>
                <p className="text-gray-600">Due Date</p>
                <p className="font-medium">{formatDate(invoice.dueDate)}</p>
              </div>
              <div>
                <p className="text-gray-600">Credit Days</p>
                <p className="font-medium">{invoice.customer.creditDays} days</p>
              </div>
              <div>
                <p className="text-gray-600">Status</p>
                <InvoiceStatusBadge status={invoice.effectiveStatus} />
              </div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Items</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-2 font-semibold text-gray-600">#</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-600">Item</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-600">HSN</th>
                  <th className="text-right px-4 py-2 font-semibold text-gray-600">Qty</th>
                  <th className="text-right px-4 py-2 font-semibold text-gray-600">Rate (Incl. Tax)</th>
                  <th className="text-right px-4 py-2 font-semibold text-gray-600">Disc %</th>
                  <th className="text-right px-4 py-2 font-semibold text-gray-600">GST %</th>
                  <th className="text-right px-4 py-2 font-semibold text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, idx) => {
                  const lineTotal = Number(item.amount) + Number(item.taxAmount);
                  return (
                    <tr key={item.id} className="border-t border-gray-100">
                      <td className="px-4 py-2 text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-2">
                        <p className="font-medium">{item.item.name}</p>
                        <p className="text-xs text-gray-500">{item.item.itemCode}</p>
                      </td>
                      <td className="px-4 py-2 text-gray-600">{item.item.hsnCode || "—"}</td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {Number(item.quantity)} {item.item.unit}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(Number(item.rate))}</td>
                      <td className="px-4 py-2 text-right text-gray-600">
                        {Number(item.discountPercent) > 0 ? `${Number(item.discountPercent)}%` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600">{Number(item.taxRate)}%</td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-800">{formatCurrency(lineTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payments + Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Payments */}
          {invoice.allocations.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Payments Received</h2>
              <div className="space-y-3">
                {invoice.allocations.map((alloc) => (
                  <div key={alloc.id} className="flex justify-between text-sm border-b pb-2">
                    <div>
                      <p className="font-medium">{alloc.payment.paymentNumber}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(alloc.payment.paymentDate)} – {alloc.payment.mode}
                      </p>
                    </div>
                    <p className="font-medium text-green-600">{formatCurrency(Number(alloc.amount))}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(Number(invoice.subtotal))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">CGST</span>
                <span className="font-medium">{formatCurrency(Number(invoice.cgst))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">SGST</span>
                <span className="font-medium">{formatCurrency(Number(invoice.sgst))}</span>
              </div>
              {Number(invoice.roundOff) !== 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Round Off</span>
                  <span className="font-medium">{formatCurrency(Number(invoice.roundOff))}</span>
                </div>
              )}
              <hr />
              <div className="flex justify-between font-semibold text-lg">
                <span>Total Amount</span>
                <span>{formatCurrency(Number(invoice.totalAmount))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Paid</span>
                <span className="font-medium text-green-600">{formatCurrency(Number(invoice.paidAmount))}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg">
                <span className="text-red-600">Balance</span>
                <span className="text-red-600">{formatCurrency(Number(invoice.balanceAmount))}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
            <h2 className="text-sm font-semibold text-gray-600 mb-2">Notes</h2>
            <p className="text-sm text-gray-700">{invoice.notes}</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
