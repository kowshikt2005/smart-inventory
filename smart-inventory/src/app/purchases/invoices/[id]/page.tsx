"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { PurchaseInvoiceStatusBadge } from "@/components/purchase-orders/PurchaseOrderStatusBadge";
import { ArrowLeft, Loader2, Trash2, CreditCard, RotateCcw } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import useSWR from "swr";

interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  vendorId: string;
  vendorName: string;
  status: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  notes: string | null;
  vendor: {
    id: string;
    vendorNumber: string;
    name: string;
    gstin: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
  };
  purchaseOrder?: {
    id: string;
    orderNumber: string;
  } | null;
  items: {
    id: string;
    itemId: string;
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
  }[];
  vendorPayments: {
    id: string;
    paymentNumber: string;
    date: string;
    amount: number;
    mode: string;
    reference: string | null;
  }[];
  purchaseReturns: {
    id: string;
    returnNumber: string;
    date: string;
    totalAmount: number;
    status: string;
  }[];
}

export default function PurchaseInvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;

  const { data: invoice, error, isLoading, mutate: _mutate } = useSWR<PurchaseInvoice>(
    `/api/purchase-invoices/${invoiceId}`
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
    if (!confirm("Are you sure you want to delete this invoice? This will reverse inventory changes.")) {
      return;
    }

    try {
      const response = await fetch(`/api/purchase-invoices/${invoiceId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete invoice");
      }

      router.push("/purchases/invoices");
    } catch (err) {
      console.error("Error deleting invoice:", err);
      alert(err instanceof Error ? err.message : "Failed to delete invoice");
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

  if (error || !invoice) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">{error?.message || "Invoice not found"}</p>
            <Button variant="outline" onClick={() => router.push("/purchases/invoices")}>
              Back to Invoices
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/purchases/invoices")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoices
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Purchase Invoice {invoice.invoiceNumber}
              </h1>
              <div className="flex items-center gap-4">
                <PurchaseInvoiceStatusBadge status={invoice.status} />
                <span className="text-gray-600">Due: {formatDate(invoice.dueDate)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/purchases/payments/new?purchaseInvoiceId=${invoice.id}`)}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Make Payment
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/purchases/returns/new?purchaseInvoiceId=${invoice.id}`)}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Create Return
                  </Button>
                </>
              )}
              {invoice.status === "PENDING" && invoice.vendorPayments.length === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Invoice Details */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Invoice Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Invoice Date</p>
                  <p className="font-medium">{formatDate(invoice.date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Due Date</p>
                  <p className="font-medium">{formatDate(invoice.dueDate)}</p>
                </div>
                {invoice.purchaseOrder && (
                  <div>
                    <p className="text-sm text-gray-500">Purchase Order</p>
                    <button
                      onClick={() => router.push(`/purchases/orders/${invoice.purchaseOrder!.id}`)}
                      className="font-medium text-teal-600 hover:underline"
                    >
                      {invoice.purchaseOrder.orderNumber}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Invoice Items</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">#</th>
                      <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">Item</th>
                      <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">HSN</th>
                      <th className="text-right py-2 px-2 text-sm font-medium text-gray-600">Qty</th>
                      <th className="text-right py-2 px-2 text-sm font-medium text-gray-600">Rate</th>
                      <th className="text-right py-2 px-2 text-sm font-medium text-gray-600">Tax</th>
                      <th className="text-right py-2 px-2 text-sm font-medium text-gray-600">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item, index) => (
                      <tr key={item.id} className="border-b last:border-b-0">
                        <td className="py-3 px-2 text-sm text-gray-500">{index + 1}</td>
                        <td className="py-3 px-2">
                          <p className="font-medium">{item.item.name}</p>
                          <p className="text-xs text-gray-500">{item.item.itemCode}</p>
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-500">{item.item.hsnCode || "-"}</td>
                        <td className="py-3 px-2 text-right text-sm">
                          {Number(item.quantity).toFixed(3)} {item.item.unit}
                        </td>
                        <td className="py-3 px-2 text-right text-sm">{formatCurrency(Number(item.rate))}</td>
                        <td className="py-3 px-2 text-right text-sm">{Number(item.taxRate)}%</td>
                        <td className="py-3 px-2 text-right font-medium">
                          {formatCurrency(Number(item.amount) + Number(item.taxAmount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t">
                      <td colSpan={6} className="py-3 px-2 text-right text-sm text-gray-600">Subtotal:</td>
                      <td className="py-3 px-2 text-right font-medium">{formatCurrency(Number(invoice.amount))}</td>
                    </tr>
                    <tr>
                      <td colSpan={6} className="py-1 px-2 text-right text-sm text-gray-600">Tax:</td>
                      <td className="py-1 px-2 text-right font-medium">{formatCurrency(Number(invoice.taxAmount))}</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="py-3 px-2 text-right text-sm font-semibold">Total:</td>
                      <td className="py-3 px-2 text-right text-lg font-bold">
                        {formatCurrency(Number(invoice.totalAmount))}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={6} className="py-1 px-2 text-right text-sm text-gray-600">Paid:</td>
                      <td className="py-1 px-2 text-right font-medium text-green-600">
                        {formatCurrency(Number(invoice.paidAmount))}
                      </td>
                    </tr>
                    <tr className="bg-yellow-50">
                      <td colSpan={6} className="py-3 px-2 text-right text-sm font-semibold">Balance:</td>
                      <td className="py-3 px-2 text-right text-lg font-bold text-red-600">
                        {formatCurrency(Number(invoice.balanceAmount))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {invoice.notes && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Notes</h2>
                <p className="text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {/* Vendor Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Vendor</h2>
              <div className="space-y-3">
                <div>
                  <p className="font-medium">{invoice.vendor.name}</p>
                  <p className="text-sm text-gray-500">{invoice.vendor.vendorNumber}</p>
                </div>
                {invoice.vendor.gstin && (
                  <div>
                    <p className="text-sm text-gray-500">GSTIN</p>
                    <p className="font-medium">{invoice.vendor.gstin}</p>
                  </div>
                )}
                {invoice.vendor.email && (
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{invoice.vendor.email}</p>
                  </div>
                )}
                {invoice.vendor.phone && (
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium">{invoice.vendor.phone}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Payments */}
            {invoice.vendorPayments.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Payments</h2>
                <div className="space-y-2">
                  {invoice.vendorPayments.map((payment) => (
                    <button
                      key={payment.id}
                      onClick={() => router.push(`/purchases/payments/${payment.id}`)}
                      className="w-full p-3 text-left border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-teal-600">{payment.paymentNumber}</p>
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded">{payment.mode}</span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {formatDate(payment.date)} - {formatCurrency(Number(payment.amount))}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Returns */}
            {invoice.purchaseReturns.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Returns</h2>
                <div className="space-y-2">
                  {invoice.purchaseReturns.map((ret) => (
                    <button
                      key={ret.id}
                      onClick={() => router.push(`/purchases/returns/${ret.id}`)}
                      className="w-full p-3 text-left border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-teal-600">{ret.returnNumber}</p>
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded">{ret.status}</span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {formatDate(ret.date)} - {formatCurrency(Number(ret.totalAmount))}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
