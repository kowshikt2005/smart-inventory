"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { SalesOrderStatusBadge } from "@/components/sales-orders/SalesOrderStatusBadge";
import { StockStatusBadge } from "@/components/sales-orders/StockStatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Loader2,
  MoreHorizontal,
  Edit,
  Trash2,
  FileText,
  CheckCircle2,
  X,
  Clock,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

interface Customer {
  id: string;
  customerNumber: string;
  name: string;
  gstin: string | null;
  city: string | null;
  state: string | null;
}

interface OrderItem {
  id: string;
  itemId: string;
  quantity: number;
  rate: number;
  discountPercent: number;
  taxRate: number;
  taxAmount: number;
  amount: number;
  hasStock: boolean;
  availableStock: number;
  item: {
    id: string;
    itemCode: string;
    name: string;
    unit: string;
    hsnCode: string | null;
    gstRate: number;
  };
}

interface SalesOrder {
  id: string;
  orderNumber: string;
  orderDate: string;
  expectedDelivery: string | null;
  referenceNumber: string | null;
  status: string;
  stockStatus: "Available" | "Partial" | "Unavailable";
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  terms: string | null;
  customer: Customer;
  items: OrderItem[];
}

export default function SalesOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await fetch(`/api/sales-orders/${id}`);
        if (!response.ok) throw new Error("Failed to fetch order");
        const data = await response.json();
        setOrder(data);
      } catch (err) {
        console.error("Error fetching order:", err);
        setError(err instanceof Error ? err.message : "Failed to load order");
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/sales-orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (response.status === 409 && data.warning) {
        const proceed = confirm(
          `Warning: Insufficient stock.\n\nDo you want to proceed anyway?`
        );
        if (proceed) {
          await fetch(`/api/sales-orders/${id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus, force: true }),
          });
          window.location.reload();
        }
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to change status");
      }

      window.location.reload();
    } catch (err) {
      console.error("Error changing status:", err);
      alert(err instanceof Error ? err.message : "Failed to change status");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this order?")) return;

    try {
      const response = await fetch(`/api/sales-orders/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete order");
      }

      router.push("/sales/orders");
    } catch (err) {
      console.error("Error deleting order:", err);
      alert(err instanceof Error ? err.message : "Failed to delete order");
    }
  };

  const handleCreateInvoice = async () => {
    try {
      const response = await fetch("/api/sales-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salesOrderId: id }),
      });

      const data = await response.json();

      if (response.status === 409 && data.invoiceId) {
        router.push(`/sales/invoices/${data.invoiceId}`);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to create invoice");
      }

      router.push(`/sales/invoices/${data.id}`);
    } catch (err) {
      console.error("Error creating invoice:", err);
      alert(err instanceof Error ? err.message : "Failed to create invoice");
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

  if (error || !order) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error || "Order not found"}
          </div>
          <Button
            onClick={() => router.push("/sales/orders")}
            variant="outline"
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
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
            onClick={() => router.push("/sales/orders")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {order.orderNumber}
              </h1>
              <p className="text-gray-600">Order Date: {formatDate(order.orderDate)}</p>
            </div>
            <div className="flex items-center gap-3">
              <SalesOrderStatusBadge status={order.status} />
              <StockStatusBadge status={order.stockStatus} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <MoreHorizontal className="h-4 w-4 mr-2" />
                    Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {order.status === "OPEN" && (
                    <>
                      <DropdownMenuItem
                        onClick={() => router.push(`/sales/orders/new?edit=${id}`)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Order
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleStatusChange("DELIVER")}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Mark as Ready
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange("HOLD")}>
                        <Clock className="h-4 w-4 mr-2" />
                        Put on Hold
                      </DropdownMenuItem>
                    </>
                  )}
                  {order.status === "DELIVER" && (
                    <DropdownMenuItem
                      onClick={() => handleStatusChange("DELIVERED")}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark as Delivered
                    </DropdownMenuItem>
                  )}
                  {order.status === "DELIVERED" && (
                    <>
                      <DropdownMenuItem onClick={handleCreateInvoice}>
                        <FileText className="h-4 w-4 mr-2" />
                        Create Invoice
                      </DropdownMenuItem>
                    </>
                  )}
                  {(order.status === "OPEN" ||
                    order.status === "HOLD" ||
                    order.status === "DELIVER") && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleStatusChange("REJECT")}
                        className="text-red-600"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel Order
                      </DropdownMenuItem>
                    </>
                  )}
                  {order.status === "OPEN" && (
                    <DropdownMenuItem
                      onClick={handleDelete}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Order
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Customer & Order Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Customer Details</h2>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-gray-600">Name</p>
                <p className="font-medium">{order.customer.name}</p>
              </div>
              <div>
                <p className="text-gray-600">Customer #</p>
                <p className="font-medium">{order.customer.customerNumber}</p>
              </div>
              {order.customer.gstin && (
                <div>
                  <p className="text-gray-600">GSTIN</p>
                  <p className="font-medium">{order.customer.gstin}</p>
                </div>
              )}
              {order.customer.city && (
                <div>
                  <p className="text-gray-600">Location</p>
                  <p className="font-medium">
                    {order.customer.city}, {order.customer.state}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Order Information</h2>
            <div className="space-y-2 text-sm">
              {order.referenceNumber && (
                <div>
                  <p className="text-gray-600">Reference</p>
                  <p className="font-medium">{order.referenceNumber}</p>
                </div>
              )}
              {order.expectedDelivery && (
                <div>
                  <p className="text-gray-600">Expected Delivery</p>
                  <p className="font-medium">{formatDate(order.expectedDelivery)}</p>
                </div>
              )}
              {order.notes && (
                <div>
                  <p className="text-gray-600">Notes</p>
                  <p className="font-medium">{order.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
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
                  <TableHead className="font-semibold text-right">
                    Discount %
                  </TableHead>
                  <TableHead className="font-semibold text-right">
                    Tax %
                  </TableHead>
                  <TableHead className="font-semibold text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow
                    key={item.id}
                    className={!item.hasStock ? "bg-yellow-50" : ""}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.item.name}</p>
                        <p className="text-xs text-gray-500">
                          {item.item.itemCode}
                        </p>
                        {!item.hasStock && (
                          <p className="text-xs text-yellow-600">
                            Stock: {item.availableStock}
                          </p>
                        )}
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
                      {Number(item.discountPercent)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(item.taxRate)}%
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

        {/* Totals */}
        <div className="flex justify-end">
          <div className="bg-white rounded-lg border border-gray-200 p-6 w-full md:w-1/2">
            <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">
                  {formatCurrency(Number(order.subtotal))}
                </span>
              </div>
              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount</span>
                  <span className="font-medium text-red-600">
                    -{formatCurrency(Number(order.discountAmount))}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax</span>
                <span className="font-medium">
                  {formatCurrency(Number(order.taxAmount))}
                </span>
              </div>
              <hr />
              <div className="flex justify-between font-semibold text-lg">
                <span>Total Amount</span>
                <span>{formatCurrency(Number(order.totalAmount))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
