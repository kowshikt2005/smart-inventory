"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PurchaseInvoiceStatusBadge, PurchaseReturnStatusBadge } from "@/components/purchase-orders/PurchaseOrderStatusBadge";
import { ArrowLeft, Loader2, Edit, Trash2, CreditCard, RotateCcw } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import useSWR from "swr";

interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  vendorId: string | null;
  vendorName: string;
  status: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  notes: string | null;
  ref: string | null;
  isImported?: boolean;
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
  } | null;
  purchaseOrder?: {
    id: string;
    orderNumber: string;
  } | null;
  items: {
    id: string;
    itemId: string | null;
    itemName: string | null;
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
    } | null;
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
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  Purchase Invoice {invoice.invoiceNumber}
                </h1>
                {invoice.ref && (
                  <span className="inline-flex items-center rounded bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-200">
                    {invoice.ref}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <PurchaseInvoiceStatusBadge status={invoice.status} />
                <span className="text-gray-600">Due: {formatDate(invoice.dueDate)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {invoice.status === "PENDING" && invoice.vendorPayments.length === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/purchases/invoices/new?edit=${invoice.id}`)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
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
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Invoice Items</h2>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold">Item</TableHead>
                      <TableHead className="font-semibold">HSN</TableHead>
                      <TableHead className="font-semibold text-right">Qty</TableHead>
                      <TableHead className="font-semibold text-right">Rate</TableHead>
                      <TableHead className="font-semibold text-right">Taxable Amt</TableHead>
                      <TableHead className="font-semibold text-right">GST %</TableHead>
                      <TableHead className="font-semibold text-right">Tax Amt</TableHead>
                      <TableHead className="font-semibold text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.items.map((item) => {
                      const taxableAmount = Number(item.amount);
                      const taxAmount = Number(item.taxAmount);
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.item?.name || item.itemName || "-"}</p>
                              <p className="text-xs text-gray-500">{item.item?.itemCode || ""}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{item.item?.hsnCode || "-"}</TableCell>
                          <TableCell className="text-right">
                            {Number(item.quantity)} {item.item?.unit || ""}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(Number(item.rate))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(taxableAmount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(item.taxRate)}%
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(taxAmount)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(taxableAmount + taxAmount)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Invoice Summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal (Taxable Amount)</span>
                  <span className="font-medium">{formatCurrency(Number(invoice.amount))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">CGST</span>
                  <span className="font-medium">{formatCurrency(Number(invoice.taxAmount) / 2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">SGST</span>
                  <span className="font-medium">{formatCurrency(Number(invoice.taxAmount) / 2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Tax</span>
                  <span className="font-medium">{formatCurrency(Number(invoice.taxAmount))}</span>
                </div>
                <hr />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total Amount</span>
                  <span>{formatCurrency(Number(invoice.totalAmount))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Paid</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(Number(invoice.paidAmount))}
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-lg">
                  <span className="text-red-600">Balance</span>
                  <span className="text-red-600">
                    {formatCurrency(Number(invoice.balanceAmount))}
                  </span>
                </div>
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
                  <p className="font-medium">{invoice.vendor?.name || invoice.vendorName}</p>
                  <p className="text-sm text-gray-500">{invoice.vendor?.vendorNumber || ''}</p>
                </div>
                {invoice.vendor?.gstin && (
                  <div>
                    <p className="text-sm text-gray-500">GSTIN</p>
                    <p className="font-medium">{invoice.vendor.gstin}</p>
                  </div>
                )}
                {invoice.vendor?.email && (
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{invoice.vendor.email}</p>
                  </div>
                )}
                {invoice.vendor?.phone && (
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium">{invoice.vendor.phone}</p>
                  </div>
                )}
                {!invoice.vendor && invoice.isImported && (
                  <p className="text-xs text-amber-600">Imported invoice — vendor not linked to masters</p>
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
                        <PurchaseReturnStatusBadge status={ret.status} size="sm" />
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
