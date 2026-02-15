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
import { PurchaseOrderStatusBadge, PurchaseInvoiceStatusBadge } from "@/components/purchase-orders/PurchaseOrderStatusBadge";
import {
  ArrowLeft,
  Loader2,
  Edit,
  Trash2,
  FileText,
  CheckCircle,
  X,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import useSWR from "swr";

interface Vendor {
  id: string;
  vendorNumber: string;
  name: string;
  gstin: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

interface Item {
  id: string;
  itemCode: string;
  name: string;
  unit: string;
  hsnCode: string | null;
}

interface OrderItem {
  id: string;
  itemId: string;
  quantity: number;
  rate: number;
  taxRate: number;
  taxAmount: number;
  amount: number;
  item: Item;
}

interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  totalAmount: number;
  status: string;
}

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  date: string;
  expectedDelivery: string | null;
  vendorId: string;
  vendorName: string;
  status: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  vendor: Vendor;
  items: OrderItem[];
  purchaseInvoices: PurchaseInvoice[];
}

export default function PurchaseOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const { data: order, error, isLoading, mutate } = useSWR<PurchaseOrder>(
    `/api/purchase-orders/${orderId}`
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
    if (!confirm("Are you sure you want to delete this purchase order?")) {
      return;
    }

    try {
      const response = await fetch(`/api/purchase-orders/${orderId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete order");
      }

      router.push("/purchases/orders");
    } catch (err) {
      console.error("Error deleting order:", err);
      alert(err instanceof Error ? err.message : "Failed to delete order");
    }
  };

  const handleStatusChange = async (newStatus: string, reason?: string) => {
    try {
      const response = await fetch(`/api/purchase-orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, reason }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to change status");
      }

      mutate();
    } catch (err) {
      console.error("Error changing status:", err);
      alert(err instanceof Error ? err.message : "Failed to change status");
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

  if (error || !order) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">
              {error?.message || "Purchase order not found"}
            </p>
            <Button variant="outline" onClick={() => router.push("/purchases/orders")}>
              Back to Orders
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/purchases/orders")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Purchase Order {order.orderNumber}
              </h1>
              <div className="flex items-center gap-4">
                <PurchaseOrderStatusBadge status={order.status} />
                <span className="text-gray-600">
                  Created on {formatDate(order.createdAt)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {order.status === "OPEN" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/purchases/orders/new?edit=${order.id}`)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              {order.status === "OPEN" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/purchases/invoices/new?purchaseOrderId=${order.id}`)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Create Invoice
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange("RECEIVED")}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Received
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange("CANCELLED", "Order cancelled")}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </>
              )}
              {(order.status === "OPEN" || order.status === "CANCELLED") && (
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
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Details */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Order Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Order Date</p>
                  <p className="font-medium">{formatDate(order.date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Expected Delivery</p>
                  <p className="font-medium">
                    {order.expectedDelivery ? formatDate(order.expectedDelivery) : "-"}
                  </p>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Order Items</h2>
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
                    {order.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.item.name}</p>
                            <p className="text-xs text-gray-500">{item.item.itemCode}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.item.hsnCode || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(item.quantity)} {item.item.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(item.rate))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(item.amount))}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(item.taxRate)}%
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(item.taxAmount))}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(item.amount) + Number(item.taxAmount))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Order Summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal (Taxable Amount)</span>
                  <span className="font-medium">{formatCurrency(Number(order.amount))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">CGST</span>
                  <span className="font-medium">{formatCurrency(Number(order.taxAmount) / 2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">SGST</span>
                  <span className="font-medium">{formatCurrency(Number(order.taxAmount) / 2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Tax</span>
                  <span className="font-medium">{formatCurrency(Number(order.taxAmount))}</span>
                </div>
                <hr />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total Amount</span>
                  <span>{formatCurrency(Number(order.totalAmount))}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Notes</h2>
                <p className="text-gray-700 whitespace-pre-wrap">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Vendor Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Vendor</h2>
              <div className="space-y-3">
                <div>
                  <p className="font-medium">{order.vendor.name}</p>
                  <p className="text-sm text-gray-500">{order.vendor.vendorNumber}</p>
                </div>
                {order.vendor.gstin && (
                  <div>
                    <p className="text-sm text-gray-500">GSTIN</p>
                    <p className="font-medium">{order.vendor.gstin}</p>
                  </div>
                )}
                {order.vendor.email && (
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{order.vendor.email}</p>
                  </div>
                )}
                {order.vendor.phone && (
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium">{order.vendor.phone}</p>
                  </div>
                )}
                {order.vendor.address && (
                  <div>
                    <p className="text-sm text-gray-500">Address</p>
                    <p className="font-medium">
                      {order.vendor.address}
                      {order.vendor.city && `, ${order.vendor.city}`}
                      {order.vendor.state && `, ${order.vendor.state}`}
                      {order.vendor.pincode && ` - ${order.vendor.pincode}`}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Linked Invoices */}
            {order.purchaseInvoices.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Linked Invoices</h2>
                <div className="space-y-2">
                  {order.purchaseInvoices.map((invoice) => (
                    <button
                      key={invoice.id}
                      onClick={() => router.push(`/purchases/invoices/${invoice.id}`)}
                      className="w-full p-3 text-left border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-teal-600">{invoice.invoiceNumber}</p>
                        <PurchaseInvoiceStatusBadge status={invoice.status} size="sm" />
                      </div>
                      <p className="text-sm text-gray-500">
                        {formatDate(invoice.date)} - {formatCurrency(Number(invoice.totalAmount))}
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
