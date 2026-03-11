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

  const hasLeftContent = invoice.vendorPayments.length > 0 || invoice.purchaseReturns.length > 0 || !!invoice.notes;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Sticky action bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => router.push("/purchases/invoices")} className="text-gray-500 -ml-2">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div className="h-4 w-px bg-gray-200" />
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-gray-900">PI {invoice.invoiceNumber}</h1>
                {invoice.ref && (
                  <span className="inline-flex items-center rounded bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-200">
                    {invoice.ref}
                  </span>
                )}
              </div>
              <PurchaseInvoiceStatusBadge status={invoice.status} />
              <span className="text-sm text-gray-400">Due {formatDate(invoice.dueDate)}</span>
            </div>
            <div className="flex items-center gap-2">
              {invoice.status === "PENDING" && invoice.vendorPayments.length === 0 && (
                <Button size="sm" variant="outline" onClick={() => router.push(`/purchases/invoices/new?edit=${invoice.id}`)}>
                  <Edit className="h-4 w-4 mr-1.5" />
                  Edit
                </Button>
              )}
              {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => router.push(`/purchases/payments/new?purchaseInvoiceId=${invoice.id}`)}>
                    <CreditCard className="h-4 w-4 mr-1.5" />
                    Pay
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => router.push(`/purchases/returns/new?purchaseInvoiceId=${invoice.id}`)}>
                    <RotateCcw className="h-4 w-4 mr-1.5" />
                    Return
                  </Button>
                </>
              )}
              {invoice.status === "PENDING" && invoice.vendorPayments.length === 0 && (
                <Button size="sm" variant="outline" onClick={handleDelete} className="text-red-600 border-red-200 hover:bg-red-50">
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Row 1: Vendor + Invoice Meta */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Vendor — 3/5 */}
            <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Vendor</p>
              <p className="text-base font-semibold text-gray-900">{invoice.vendor?.name || invoice.vendorName}</p>
              {invoice.vendor && (
                <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
                  <span className="text-gray-400">Vendor #</span>
                  <span className="text-gray-700">{invoice.vendor.vendorNumber}</span>
                  {invoice.vendor.gstin && (
                    <>
                      <span className="text-gray-400">GSTIN</span>
                      <span className="text-gray-700 font-mono text-xs">{invoice.vendor.gstin}</span>
                    </>
                  )}
                  {invoice.vendor.email && (
                    <>
                      <span className="text-gray-400">Email</span>
                      <span className="text-gray-700">{invoice.vendor.email}</span>
                    </>
                  )}
                  {invoice.vendor.phone && (
                    <>
                      <span className="text-gray-400">Phone</span>
                      <span className="text-gray-700">{invoice.vendor.phone}</span>
                    </>
                  )}
                </div>
              )}
              {!invoice.vendor && invoice.isImported && (
                <p className="text-xs text-amber-600 mt-2">Imported invoice — vendor not linked to masters</p>
              )}
            </div>

            {/* Invoice meta — 2/5 */}
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5 flex flex-col">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Invoice Details</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm flex-1">
                <dt className="text-gray-400">Invoice Date</dt>
                <dd className="text-gray-900 font-medium text-right">{formatDate(invoice.date)}</dd>
                <dt className="text-gray-400">Due Date</dt>
                <dd className="text-gray-900 font-medium text-right">{formatDate(invoice.dueDate)}</dd>
                {invoice.purchaseOrder && (
                  <>
                    <dt className="text-gray-400">PO Ref</dt>
                    <dd className="text-right">
                      <button
                        onClick={() => router.push(`/purchases/orders/${invoice.purchaseOrder!.id}`)}
                        className="text-teal-600 hover:underline font-medium text-sm"
                      >
                        {invoice.purchaseOrder.orderNumber}
                      </button>
                    </dd>
                  </>
                )}
              </dl>
              {/* Quick totals */}
              <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(Number(invoice.totalAmount))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Paid</span>
                  <span className="font-medium text-green-600">{formatCurrency(Number(invoice.paidAmount))}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span className={Number(invoice.balanceAmount) > 0 ? "text-red-600" : "text-green-600"}>Balance</span>
                  <span className={Number(invoice.balanceAmount) > 0 ? "text-red-600" : "text-green-600"}>
                    {formatCurrency(Number(invoice.balanceAmount))}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Items table — full width */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Line Items</p>
              <span className="text-xs text-gray-400">{invoice.items.length} item{invoice.items.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Item</TableHead>
                    <TableHead className="font-semibold">HSN</TableHead>
                    <TableHead className="font-semibold text-right">Qty</TableHead>
                    <TableHead className="font-semibold text-right">Rate</TableHead>
                    <TableHead className="font-semibold text-right">Taxable</TableHead>
                    <TableHead className="font-semibold text-right">GST %</TableHead>
                    <TableHead className="font-semibold text-right">Tax</TableHead>
                    <TableHead className="font-semibold text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items.map((item) => {
                    const taxableAmount = Number(item.amount);
                    const taxAmount = Number(item.taxAmount);
                    return (
                      <TableRow key={item.id} className="hover:bg-gray-50">
                        <TableCell>
                          <p className="font-medium text-gray-900">{item.item?.name || item.itemName || "—"}</p>
                          <p className="text-xs text-gray-400">{item.item?.itemCode || ""}</p>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{item.item?.hsnCode || "—"}</TableCell>
                        <TableCell className="text-right text-sm">{Number(item.quantity)} {item.item?.unit || ""}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(Number(item.rate))}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(taxableAmount)}</TableCell>
                        <TableCell className="text-right text-sm">{Number(item.taxRate)}%</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(taxAmount)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(taxableAmount + taxAmount)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Row 3: Payments/Returns/Notes (left) + Summary (right) */}
          {hasLeftContent ? (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3 space-y-4">
                {invoice.vendorPayments.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Payments</p>
                    <div className="space-y-0">
                      {invoice.vendorPayments.map((payment) => (
                        <button
                          key={payment.id}
                          onClick={() => router.push(`/purchases/payments/${payment.id}`)}
                          className="w-full flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded px-1 text-left"
                        >
                          <div>
                            <p className="text-sm font-medium text-teal-600">{payment.paymentNumber}</p>
                            <p className="text-xs text-gray-400">{formatDate(payment.date)} · {payment.mode}</p>
                          </div>
                          <span className="text-sm font-semibold text-green-600">{formatCurrency(Number(payment.amount))}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {invoice.purchaseReturns.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Returns</p>
                    <div className="space-y-0">
                      {invoice.purchaseReturns.map((ret) => (
                        <button
                          key={ret.id}
                          onClick={() => router.push(`/purchases/returns/${ret.id}`)}
                          className="w-full flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded px-1 text-left"
                        >
                          <div>
                            <p className="text-sm font-medium text-teal-600">{ret.returnNumber}</p>
                            <p className="text-xs text-gray-400">{formatDate(ret.date)} · {formatCurrency(Number(ret.totalAmount))}</p>
                          </div>
                          <PurchaseReturnStatusBadge status={ret.status} size="sm" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {invoice.notes && (
                  <div className="bg-white rounded-lg border border-gray-200 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Notes</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
                  </div>
                )}
              </div>
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Summary</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Taxable Value</span>
                      <span className="font-medium">{formatCurrency(Number(invoice.amount))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">CGST</span>
                      <span>{formatCurrency(Number(invoice.taxAmount) / 2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">SGST</span>
                      <span>{formatCurrency(Number(invoice.taxAmount) / 2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Tax</span>
                      <span>{formatCurrency(Number(invoice.taxAmount))}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
                      <span>Total</span>
                      <span>{formatCurrency(Number(invoice.totalAmount))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Paid</span>
                      <span className="font-medium text-green-600">{formatCurrency(Number(invoice.paidAmount))}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold pt-1 border-t border-gray-100">
                      <span className={Number(invoice.balanceAmount) > 0 ? "text-red-600" : "text-green-600"}>Balance Due</span>
                      <span className={Number(invoice.balanceAmount) > 0 ? "text-red-600" : "text-green-600"}>
                        {formatCurrency(Number(invoice.balanceAmount))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <div className="w-full max-w-sm bg-white rounded-lg border border-gray-200 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Summary</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Taxable Value</span>
                    <span className="font-medium">{formatCurrency(Number(invoice.amount))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">CGST</span>
                    <span>{formatCurrency(Number(invoice.taxAmount) / 2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">SGST</span>
                    <span>{formatCurrency(Number(invoice.taxAmount) / 2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Tax</span>
                    <span>{formatCurrency(Number(invoice.taxAmount))}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
                    <span>Total</span>
                    <span>{formatCurrency(Number(invoice.totalAmount))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Paid</span>
                    <span className="font-medium text-green-600">{formatCurrency(Number(invoice.paidAmount))}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold pt-1 border-t border-gray-100">
                    <span className={Number(invoice.balanceAmount) > 0 ? "text-red-600" : "text-green-600"}>Balance Due</span>
                    <span className={Number(invoice.balanceAmount) > 0 ? "text-red-600" : "text-green-600"}>
                      {formatCurrency(Number(invoice.balanceAmount))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
