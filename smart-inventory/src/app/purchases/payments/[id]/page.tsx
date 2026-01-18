"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import useSWR from "swr";

interface VendorPayment {
  id: string;
  paymentNumber: string;
  date: string;
  vendorId: string;
  purchaseInvoiceId: string;
  amount: number;
  mode: string;
  paidFrom: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  vendor: {
    id: string;
    vendorNumber: string;
    name: string;
    gstin: string | null;
    email: string | null;
    phone: string | null;
  };
  purchaseInvoice: {
    id: string;
    invoiceNumber: string;
    date: string;
    dueDate: string;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    status: string;
  };
}

export default function VendorPaymentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const paymentId = params.id as string;

  const { data: payment, error, isLoading } = useSWR<VendorPayment>(
    `/api/vendor-payments/${paymentId}`
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this payment?")) {
      return;
    }

    try {
      const response = await fetch(`/api/vendor-payments/${paymentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete payment");
      }

      router.push("/purchases/payments");
    } catch (err) {
      console.error("Error deleting payment:", err);
      alert(err instanceof Error ? err.message : "Failed to delete payment");
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !payment) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">{error?.message || "Payment not found"}</p>
            <Button variant="outline" onClick={() => router.push("/purchases/payments")}>
              Back to Payments
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/purchases/payments")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Payments
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Payment {payment.paymentNumber}
              </h1>
              <p className="text-gray-600">Created on {formatDate(payment.createdAt)}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payment Details */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Payment Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Payment Date</p>
                  <p className="font-medium">{formatDate(payment.date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="text-2xl font-bold text-teal-600">{formatCurrency(Number(payment.amount))}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Payment Mode</p>
                  <p className="font-medium">{payment.mode}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Paid From</p>
                  <p className="font-medium">{payment.paidFrom === "Cash" ? "Cash" : "Bank Account"}</p>
                </div>
              </div>
              {payment.reference && (
                <div>
                  <p className="text-sm text-gray-500">Reference</p>
                  <p className="font-medium">{payment.reference}</p>
                </div>
              )}
              {payment.notes && (
                <div>
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="font-medium">{payment.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Vendor Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Vendor</h2>
            <div className="space-y-3">
              <div>
                <p className="font-medium">{payment.vendor.name}</p>
                <p className="text-sm text-gray-500">{payment.vendor.vendorNumber}</p>
              </div>
              {payment.vendor.gstin && (
                <div>
                  <p className="text-sm text-gray-500">GSTIN</p>
                  <p className="font-medium">{payment.vendor.gstin}</p>
                </div>
              )}
              {payment.vendor.email && (
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{payment.vendor.email}</p>
                </div>
              )}
              {payment.vendor.phone && (
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium">{payment.vendor.phone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Invoice Info */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Invoice Details</h2>
            <button
              onClick={() => router.push(`/purchases/invoices/${payment.purchaseInvoice.id}`)}
              className="block w-full p-4 border rounded-lg hover:bg-gray-50 text-left"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-teal-600">{payment.purchaseInvoice.invoiceNumber}</p>
                <span className="text-xs px-2 py-1 bg-gray-100 rounded">{payment.purchaseInvoice.status}</span>
              </div>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Invoice Date</p>
                  <p className="font-medium">{formatDate(payment.purchaseInvoice.date)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Total Amount</p>
                  <p className="font-medium">{formatCurrency(Number(payment.purchaseInvoice.totalAmount))}</p>
                </div>
                <div>
                  <p className="text-gray-500">Paid Amount</p>
                  <p className="font-medium text-green-600">{formatCurrency(Number(payment.purchaseInvoice.paidAmount))}</p>
                </div>
                <div>
                  <p className="text-gray-500">Balance</p>
                  <p className="font-medium text-red-600">{formatCurrency(Number(payment.purchaseInvoice.balanceAmount))}</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
