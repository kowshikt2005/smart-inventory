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
import { ArrowLeft, Loader2, Ban, FileDown, MapPin, Edit } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { generateInvoicePDF } from "@/lib/invoice-pdf";
import { fetchCompanySettings } from "@/lib/export-utils";

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
  itemId: string | null;
  itemName: string | null;
  ref: string | null;
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
    sellingPrice: number;
    mrp: number;
  } | null;
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

interface ShippingAddress {
  id: string;
  label: string;
  address: string;
  city: string | null;
  state: string | null;
  pincode: string | null;
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
  ref: string | null;
  isImported?: boolean;
  customerName?: string | null;
  customer: Customer | null;
  items: InvoiceItem[];
  allocations: PaymentAllocation[];
  shippingAddress: ShippingAddress | null;
  salesReturns?: { id: string; returnNumber: string; status: string; returnDate: string }[];
}

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoice = useCallback(async () => {
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
  }, [id]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

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

  const handleDownloadPDF = async () => {
    if (!invoice) return;

    setIsPdfLoading(true);
    try {
      const { company, bank } = await fetchCompanySettings();
      generateInvoicePDF({
        ...invoice,
        customer: {
          name: invoice.customer?.name || invoice.customerName || "Unknown Customer",
          gstin: invoice.customer?.gstin || null,
          address: invoice.customer?.address || null,
          city: invoice.customer?.city || null,
          state: invoice.customer?.state || null,
          pincode: invoice.customer?.pincode || null,
        },
        items: invoice.items.map((item) => ({
          ...item,
          item: item.item ?? {
            name: item.itemName || "Unknown Item",
            hsnCode: null,
            unit: "",
            sellingPrice: Number(item.rate),
            mrp: Number(item.rate),
          },
        })),
      }, company, bank);
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsPdfLoading(false);
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

  const hasLeftContent = invoice.allocations.length > 0 || !!invoice.notes;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Sticky action bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-gray-500 -ml-2">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div className="h-4 w-px bg-gray-200" />
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-gray-900">{invoice.invoiceNumber}</h1>
                {invoice.ref && (
                  <span className="inline-flex items-center rounded bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-200">
                    {invoice.ref}
                  </span>
                )}
                {invoice.orderNumber && (
                  <span className="text-sm text-gray-400">· Order {invoice.orderNumber}</span>
                )}
              </div>
              <InvoiceStatusBadge status={invoice.effectiveStatus} />
            </div>
            <div className="flex items-center gap-2">
              {invoice.effectiveStatus === "PENDING" && invoice.allocations.length === 0 && (
                <Button size="sm" variant="outline" onClick={() => router.push(`/sales/invoices/new?edit=${invoice.id}`)}>
                  <Edit className="h-4 w-4 mr-1.5" />
                  Edit
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleDownloadPDF} disabled={isPdfLoading}>
                {isPdfLoading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileDown className="h-4 w-4 mr-1.5" />}
                PDF
              </Button>
              {invoice.effectiveStatus !== "PAID" && invoice.effectiveStatus !== "CANCELLED" && (
                <Button size="sm" variant="outline" onClick={handleCancel} className="text-red-600 border-red-200 hover:bg-red-50">
                  <Ban className="h-4 w-4 mr-1.5" />
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Row 1: Bill To + Invoice Meta */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Customer — 3/5 width */}
            <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Bill To</p>
              <p className="text-base font-semibold text-gray-900">
                {invoice.customer?.name || invoice.customerName || "—"}
              </p>
              {invoice.customer && (
                <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
                  <span className="text-gray-400">Customer #</span>
                  <span className="text-gray-700">{invoice.customer.customerNumber}</span>
                  {invoice.customer.gstin && (
                    <>
                      <span className="text-gray-400">GSTIN</span>
                      <span className="text-gray-700 font-mono text-xs">{invoice.customer.gstin}</span>
                    </>
                  )}
                  {invoice.customer.address && (
                    <>
                      <span className="text-gray-400">Address</span>
                      <span className="text-gray-700">
                        {invoice.customer.address}
                        {(invoice.customer.city || invoice.customer.state) && (
                          <span className="block text-gray-500">
                            {[invoice.customer.city, invoice.customer.state, invoice.customer.pincode].filter(Boolean).join(", ")}
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </div>
              )}
              {!invoice.customer && invoice.isImported && (
                <div className="mt-2">
                  <p className="text-xs text-amber-600 mb-1">Customer not linked to masters</p>
                  <button
                    className="text-xs text-teal-600 hover:text-teal-700 underline underline-offset-2"
                    onClick={() => {
                      const qs = new URLSearchParams({
                        openCreate: "true",
                        returnTo: `/sales/invoices/${id}`,
                        salesInvoiceId: id,
                        prefillName: invoice.customerName || "",
                      });
                      router.push(`/masters/customers?${qs.toString()}`);
                    }}
                  >
                    Create &amp; link customer
                  </button>
                </div>
              )}
              {invoice.shippingAddress && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Ship To
                  </p>
                  <p className="text-sm font-medium text-gray-800">{invoice.shippingAddress.label}</p>
                  <p className="text-sm text-gray-600">{invoice.shippingAddress.address}</p>
                  {(invoice.shippingAddress.city || invoice.shippingAddress.state) && (
                    <p className="text-sm text-gray-500">
                      {[invoice.shippingAddress.city, invoice.shippingAddress.state, invoice.shippingAddress.pincode].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Invoice meta — 2/5 width */}
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5 flex flex-col">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Invoice Details</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                <dt className="text-gray-400">Invoice Date</dt>
                <dd className="text-gray-900 font-medium text-right">{formatDate(invoice.invoiceDate)}</dd>
                <dt className="text-gray-400">Due Date</dt>
                <dd className="text-gray-900 font-medium text-right">{formatDate(invoice.dueDate)}</dd>
                <dt className="text-gray-400">Credit Days</dt>
                <dd className="text-gray-900 font-medium text-right">{invoice.customer?.creditDays ?? "—"} days</dd>
              </dl>
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
                    <TableHead className="font-semibold text-right">Disc %</TableHead>
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
                    const totalAmount = taxableAmount + taxAmount;
                    return (
                      <TableRow key={item.id} className="hover:bg-gray-50">
                        <TableCell>
                          <p className="font-medium text-gray-900">{item.item?.name || item.itemName || "—"}</p>
                          {item.item ? (
                            <p className="text-xs text-gray-400">{item.item.itemCode}</p>
                          ) : (
                            <button
                              className="text-xs text-amber-600 hover:text-amber-700 underline underline-offset-2 mt-0.5"
                              onClick={() => {
                                const hsnFromRef = item.ref?.startsWith("HSN:") ? item.ref.slice(4) : "";
                                const params = new URLSearchParams({
                                  openCreate: "true",
                                  returnTo: `/sales/invoices/${id}`,
                                  invoiceItemId: item.id,
                                  invoiceType: "SALES",
                                  prefillName: item.itemName || "",
                                  prefillRate: String(Number(item.rate)),
                                  prefillGstRate: String(Math.round(Number(item.taxRate))),
                                  prefillHsnCode: hsnFromRef,
                                });
                                router.push(`/masters/items?${params.toString()}`);
                              }}
                            >
                              Not in masters — Create item
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{item.item?.hsnCode || "—"}</TableCell>
                        <TableCell className="text-right text-sm">{Number(item.quantity)} {item.item?.unit || ""}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(Number(item.rate))}</TableCell>
                        <TableCell className="text-right text-sm">
                          {Number(item.discountPercent) > 0 ? (
                            <span className="text-orange-600">{Number(item.discountPercent)}%</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(taxableAmount)}</TableCell>
                        <TableCell className="text-right text-sm">{Number(item.taxRate)}%</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(taxAmount)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(totalAmount)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Row 3: Payments/Notes (left) + Summary (right) */}
          {hasLeftContent ? (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3 space-y-4">
                {invoice.allocations.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Payments Received</p>
                    <div className="space-y-0">
                      {invoice.allocations.map((alloc) => (
                        <div key={alloc.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{alloc.payment.paymentNumber}</p>
                            <p className="text-xs text-gray-400">{formatDate(alloc.payment.paymentDate)} · {alloc.payment.mode}</p>
                          </div>
                          <span className="text-sm font-semibold text-green-600">{formatCurrency(Number(alloc.amount))}</span>
                        </div>
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
                      <span className="text-gray-500">Subtotal (Taxable)</span>
                      <span className="font-medium">{formatCurrency(Number(invoice.subtotal))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">CGST</span>
                      <span>{formatCurrency(Number(invoice.cgst))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">SGST</span>
                      <span>{formatCurrency(Number(invoice.sgst))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Tax</span>
                      <span>{formatCurrency(Number(invoice.taxAmount))}</span>
                    </div>
                    {Number(invoice.roundOff) !== 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Round Off</span>
                        <span>{formatCurrency(Number(invoice.roundOff))}</span>
                      </div>
                    )}
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
                    <span className="text-gray-500">Subtotal (Taxable)</span>
                    <span className="font-medium">{formatCurrency(Number(invoice.subtotal))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">CGST</span>
                    <span>{formatCurrency(Number(invoice.cgst))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">SGST</span>
                    <span>{formatCurrency(Number(invoice.sgst))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Tax</span>
                    <span>{formatCurrency(Number(invoice.taxAmount))}</span>
                  </div>
                  {Number(invoice.roundOff) !== 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Round Off</span>
                      <span>{formatCurrency(Number(invoice.roundOff))}</span>
                    </div>
                  )}
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
