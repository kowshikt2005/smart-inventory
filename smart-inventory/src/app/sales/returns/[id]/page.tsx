"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ReturnStatusBadge } from "@/components/sales-returns/ReturnStatusBadge";
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
  CheckCircle2,
  Ban,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

interface Customer {
  id: string;
  customerNumber: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
}

interface ReturnItem {
  id: string;
  quantity: number;
  rate: number;
  taxRate: number;
  taxAmount: number;
  amount: number;
  item: {
    id: string;
    itemCode: string;
    name: string;
    unit: string;
    hsnCode: string | null;
  };
}

interface SalesReturn {
  id: string;
  returnNumber: string;
  returnDate: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  reason: string | null;
  status: string;
  customer: Customer;
  invoice: Invoice | null;
  items: ReturnItem[];
}

export default function SalesReturnDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [salesReturn, setSalesReturn] = useState<SalesReturn | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReturn = async () => {
      try {
        const response = await fetch(`/api/sales-returns/${id}`);
        if (!response.ok) throw new Error("Failed to fetch return");
        const data = await response.json();
        setSalesReturn(data);
      } catch (err) {
        console.error("Error fetching return:", err);
        setError(err instanceof Error ? err.message : "Failed to load return");
      } finally {
        setIsLoading(false);
      }
    };
    fetchReturn();
  }, [id]);

  const handleComplete = async () => {
    if (!confirm("Complete this return? This will restore inventory and create a credit ledger entry.")) return;

    try {
      const response = await fetch(`/api/sales-returns/${id}/complete`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to complete return");
      }

      window.location.reload();
    } catch (err) {
      console.error("Error completing return:", err);
      alert(err instanceof Error ? err.message : "Failed to complete return");
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this return?")) return;

    try {
      const response = await fetch(`/api/sales-returns/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel return");
      }

      router.push("/sales/returns");
    } catch (err) {
      console.error("Error cancelling return:", err);
      alert(err instanceof Error ? err.message : "Failed to cancel return");
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

  if (error || !salesReturn) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error || "Return not found"}
          </div>
          <Button onClick={() => router.push("/sales/returns")} variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Returns
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/sales/returns")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Returns
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{salesReturn.returnNumber}</h1>
              <p className="text-gray-600">Return Date: {formatDate(salesReturn.returnDate)}</p>
            </div>
            <div className="flex items-center gap-3">
              <ReturnStatusBadge status={salesReturn.status} />
              {salesReturn.status === "OPEN" && (
                <div className="flex gap-2">
                  <Button onClick={handleComplete} className="bg-green-500 hover:bg-green-600">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Complete Return
                  </Button>
                  <Button onClick={handleCancel} variant="outline" className="text-red-600">
                    <Ban className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Customer & Return Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Customer Details</h2>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-gray-600">Name</p>
                <p className="font-medium">{salesReturn.customer.name}</p>
              </div>
              <div>
                <p className="text-gray-600">Customer #</p>
                <p className="font-medium">{salesReturn.customer.customerNumber}</p>
              </div>
              {salesReturn.customer.phone && (
                <div>
                  <p className="text-gray-600">Phone</p>
                  <p className="font-medium">{salesReturn.customer.phone}</p>
                </div>
              )}
              {salesReturn.customer.city && (
                <div>
                  <p className="text-gray-600">Location</p>
                  <p className="font-medium">{salesReturn.customer.city}, {salesReturn.customer.state}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Return Information</h2>
            <div className="space-y-2 text-sm">
              {salesReturn.invoice && (
                <div>
                  <p className="text-gray-600">Original Invoice</p>
                  <button onClick={() => router.push(`/sales/invoices/${salesReturn.invoice!.id}`)} className="font-medium text-teal-600 hover:underline">
                    {salesReturn.invoice.invoiceNumber}
                  </button>
                </div>
              )}
              {salesReturn.reason && (
                <div>
                  <p className="text-gray-600">Reason</p>
                  <p className="font-medium">{salesReturn.reason}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Return Items</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Item</TableHead>
                  <TableHead className="font-semibold">HSN</TableHead>
                  <TableHead className="font-semibold text-right">Qty</TableHead>
                  <TableHead className="font-semibold text-right">Rate</TableHead>
                  <TableHead className="font-semibold text-right">Tax %</TableHead>
                  <TableHead className="font-semibold text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesReturn.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.item.name}</p>
                        <p className="text-xs text-gray-500">{item.item.itemCode}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{item.item.hsnCode || "-"}</TableCell>
                    <TableCell className="text-right">{Number(item.quantity)} {item.item.unit}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(item.rate))}</TableCell>
                    <TableCell className="text-right">{Number(item.taxRate)}%</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(item.amount) + Number(item.taxAmount))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="bg-white rounded-lg border border-gray-200 p-6 w-full md:w-1/2">
            <h2 className="text-lg font-semibold mb-4">Return Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(Number(salesReturn.subtotal))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax</span>
                <span className="font-medium">{formatCurrency(Number(salesReturn.taxAmount))}</span>
              </div>
              <hr />
              <div className="flex justify-between font-semibold text-lg">
                <span>Total Credit</span>
                <span className="text-red-600">{formatCurrency(Number(salesReturn.totalAmount))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
