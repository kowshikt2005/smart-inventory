"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Loader2,
  Trash2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

interface Customer {
  id: string;
  customerNumber: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: string;
}

interface PaymentAllocation {
  id: string;
  amount: number;
  invoice: Invoice;
}

interface Payment {
  id: string;
  paymentNumber: string;
  paymentDate: string;
  amount: number;
  mode: string;
  referenceNumber: string | null;
  notes: string | null;
  customer: Customer;
  allocations: PaymentAllocation[];
}

const MODE_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  UPI: "UPI",
  CARD: "Card",
  OTHER: "Other",
};

export default function PaymentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [payment, setPayment] = useState<Payment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPayment = async () => {
      try {
        const response = await fetch(`/api/payments/${id}`);
        if (!response.ok) throw new Error("Failed to fetch payment");
        const data = await response.json();
        setPayment(data);
      } catch (err) {
        console.error("Error fetching payment:", err);
        setError(err instanceof Error ? err.message : "Failed to load payment");
      } finally {
        setIsLoading(false);
      }
    };
    fetchPayment();
  }, [id]);

  const handleReverse = async () => {
    if (!confirm("Are you sure you want to reverse this payment? This will update invoice balances and ledger.")) return;

    try {
      const response = await fetch(`/api/payments/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reverse payment");
      }

      router.push("/sales/receipts");
    } catch (err) {
      console.error("Error reversing payment:", err);
      alert(err instanceof Error ? err.message : "Failed to reverse payment");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
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

  if (error || !payment) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error || "Payment not found"}
          </div>
          <Button onClick={() => router.push("/sales/receipts")} variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Receipts
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/sales/receipts")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Receipts
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{payment.paymentNumber}</h1>
              <p className="text-gray-600">Payment Date: {formatDate(payment.paymentDate)}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-lg px-3 py-1">
                {MODE_LABELS[payment.mode] || payment.mode}
              </Badge>
              <Button onClick={handleReverse} variant="outline" className="text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Reverse Payment
              </Button>
            </div>
          </div>
        </div>

        {/* Payment Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Customer Details</h2>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-gray-600">Name</p>
                <p className="font-medium">{payment.customer.name}</p>
              </div>
              <div>
                <p className="text-gray-600">Customer #</p>
                <p className="font-medium">{payment.customer.customerNumber}</p>
              </div>
              {payment.customer.email && (
                <div>
                  <p className="text-gray-600">Email</p>
                  <p className="font-medium">{payment.customer.email}</p>
                </div>
              )}
              {payment.customer.phone && (
                <div>
                  <p className="text-gray-600">Phone</p>
                  <p className="font-medium">{payment.customer.phone}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Payment Details</h2>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-gray-600">Amount</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(Number(payment.amount))}</p>
              </div>
              <div>
                <p className="text-gray-600">Payment Mode</p>
                <p className="font-medium">{MODE_LABELS[payment.mode] || payment.mode}</p>
              </div>
              {payment.referenceNumber && (
                <div>
                  <p className="text-gray-600">Reference Number</p>
                  <p className="font-medium">{payment.referenceNumber}</p>
                </div>
              )}
              {payment.notes && (
                <div>
                  <p className="text-gray-600">Notes</p>
                  <p className="font-medium">{payment.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Invoice Allocations */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Invoice Allocations</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Invoice #</TableHead>
                  <TableHead className="font-semibold">Invoice Date</TableHead>
                  <TableHead className="font-semibold text-right">Invoice Total</TableHead>
                  <TableHead className="font-semibold text-right">Allocated Amount</TableHead>
                  <TableHead className="font-semibold text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payment.allocations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                      No invoice allocations
                    </TableCell>
                  </TableRow>
                ) : (
                  payment.allocations.map((alloc) => (
                    <TableRow key={alloc.id}>
                      <TableCell>
                        <button onClick={() => router.push(`/sales/invoices/${alloc.invoice.id}`)} className="font-medium text-teal-600 hover:underline">
                          {alloc.invoice.invoiceNumber}
                        </button>
                      </TableCell>
                      <TableCell>{formatDate(alloc.invoice.invoiceDate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(alloc.invoice.totalAmount))}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">{formatCurrency(Number(alloc.amount))}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={alloc.invoice.paymentStatus === "PAID" ? "default" : "secondary"} className={alloc.invoice.paymentStatus === "PAID" ? "bg-green-100 text-green-800" : ""}>
                          {alloc.invoice.paymentStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
