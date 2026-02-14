"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Loader2, Save, Ban, Edit } from "lucide-react";
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
    standardPrice: number;
  };
}

interface Payment {
  id: string;
  paymentNumber: string;
  paymentDate: string;
  amount: number;
  mode: string;
}

interface PaymentAllocation {
  id: string;
  amount: number;
  payment: Payment;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  orderNumber: string | null;
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

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const response = await fetch(`/api/sales-invoices/${id}`);
        if (!response.ok) throw new Error("Failed to fetch invoice");
        const data = await response.json();
        setInvoice(data);
      } catch (err) {
        console.error("Error fetching invoice:", err);
        setError(err instanceof Error ? err.message : "Failed to load invoice");
      } finally {
        setIsLoading(false);
      }
    };
    fetchInvoice();
  }, [id]);

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this invoice?")) return;

    try {
      const response = await fetch(`/api/sales-invoices/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel invoice");
      }

      router.push("/sales/invoices");
    } catch (err) {
      console.error("Error cancelling invoice:", err);
      alert(err instanceof Error ? err.message : "Failed to cancel invoice");
    }
  };

  const handleSaveInvoice = async () => {
    if (!invoice) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/sales-invoices/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(invoice),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save invoice");
      }

      alert("Invoice saved successfully!");
      router.push("/sales/invoices");
    } catch (err) {
      console.error("Error saving invoice:", err);
      alert(err instanceof Error ? err.message : "Failed to save invoice");
    } finally {
      setIsSaving(false);
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

  if (error || !invoice) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error || "Invoice not found"}
          </div>
          <Button
            onClick={() => router.push("/sales/invoices")}
            variant="outline"
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoices
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {invoice.invoiceNumber}
              </h1>
              {invoice.orderNumber && (
                <p className="text-gray-600">
                  Order: {invoice.orderNumber}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <InvoiceStatusBadge status={invoice.effectiveStatus} />
              {invoice.effectiveStatus === "PENDING" && (
                <Button
                  onClick={() => router.push(`/sales/invoices/new?edit=${invoice.id}`)}
                  variant="outline"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Invoice
                </Button>
              )}
              {invoice.effectiveStatus !== "PAID" &&
                invoice.effectiveStatus !== "CANCELLED" && (
                  <>
                    <Button
                      onClick={handleSaveInvoice}
                      disabled={isSaving}
                      className="bg-teal-500 hover:bg-teal-600"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Invoice
                    </Button>
                    <Button
                      onClick={handleCancel}
                      variant="outline"
                      className="text-red-600 border-red-600 hover:bg-red-50"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Cancel Invoice
                    </Button>
                  </>
                )}
            </div>
          </div>
        </div>

        {/* Invoice Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Customer Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Customer Details</h2>
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
                    {invoice.customer.city}, {invoice.customer.state} -{" "}
                    {invoice.customer.pincode}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Invoice Info */}
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
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Items</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Item</TableHead>
                  <TableHead className="font-semibold">HSN</TableHead>
                  <TableHead className="font-semibold text-right">Qty</TableHead>
                  <TableHead className="font-semibold text-right">Rate</TableHead>
                  <TableHead className="font-semibold text-right">Disc %</TableHead>
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
                  const totalAmount = taxableAmount + taxAmount;

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.item.name}</p>
                          <p className="text-xs text-gray-500">
                            {item.item.itemCode}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{item.item.hsnCode || "-"}</TableCell>
                      <TableCell className="text-right">
                        {Number(item.quantity)} {item.item.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(item.rate))}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(item.discountPercent) > 0 ? (
                          <span className="text-orange-600">{Number(item.discountPercent)}%</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
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
                        {formatCurrency(totalAmount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Payments */}
          {invoice.allocations.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Payments Received</h2>
              <div className="space-y-3">
                {invoice.allocations.map((alloc) => (
                  <div
                    key={alloc.id}
                    className="flex justify-between text-sm border-b pb-2"
                  >
                    <div>
                      <p className="font-medium">
                        {alloc.payment.paymentNumber}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(alloc.payment.paymentDate)} -{" "}
                        {alloc.payment.mode}
                      </p>
                    </div>
                    <p className="font-medium text-green-600">
                      {formatCurrency(Number(alloc.amount))}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal (Taxable Amount)</span>
                <span className="font-medium">
                  {formatCurrency(Number(invoice.subtotal))}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">CGST</span>
                <span className="font-medium">
                  {formatCurrency(Number(invoice.cgst))}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">SGST</span>
                <span className="font-medium">
                  {formatCurrency(Number(invoice.sgst))}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Tax</span>
                <span className="font-medium">
                  {formatCurrency(Number(invoice.taxAmount))}
                </span>
              </div>
              {Number(invoice.roundOff) !== 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Round Off</span>
                  <span className="font-medium">
                    {formatCurrency(Number(invoice.roundOff))}
                  </span>
                </div>
              )}
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
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
            <h2 className="text-lg font-semibold mb-2">Notes</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
