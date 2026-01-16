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
  AlertTriangle,
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

interface StockInfo {
  physicalStock: number;
  reservedQuantity: number;
  availableStock: number;
  requiredQuantity: number;
  allocatedQty: number;
  canFulfill: number;
  shortfall: number;
  stockStatus: 'Available' | 'Partial' | 'Unavailable';
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
  stockInfo?: StockInfo;
  item: {
    id: string;
    itemCode: string;
    name: string;
    unit: string;
    hsnCode: string | null;
    gstRate: number;
  };
}

interface InsufficientStockItem {
  itemName: string;
  itemCode: string;
  required: number;
  available: number;
  shortfall: number;
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

      // Handle insufficient stock error
      if (!response.ok && data.insufficientStock) {
        const stockDetails = data.insufficientStock
          .map(
            (item: InsufficientStockItem) =>
              `${item.itemName} (${item.itemCode}):\n  Required: ${item.required}\n  Available: ${item.available}\n  Missing: ${item.shortfall}`
          )
          .join("\n\n");
        alert(`${data.error}\n\n${stockDetails}`);
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
                  {/* Edit - only for OPEN orders */}
                  {order.status === "OPEN" && (
                    <DropdownMenuItem
                      onClick={() => router.push(`/sales/orders/new?edit=${id}`)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Order
                    </DropdownMenuItem>
                  )}

                  {/* Create Invoice - for all non-rejected orders */}
                  {order.status !== "REJECTED" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleCreateInvoice}>
                        <FileText className="h-4 w-4 mr-2" />
                        Create Invoice
                      </DropdownMenuItem>
                    </>
                  )}

                  {/* Status transitions */}
                  {order.status === "OPEN" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleStatusChange("HOLD")}>
                        <Clock className="h-4 w-4 mr-2" />
                        Put on Hold
                      </DropdownMenuItem>
                    </>
                  )}

                  {order.status === "HOLD" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleStatusChange("OPEN")}>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Release Hold
                      </DropdownMenuItem>
                    </>
                  )}

                  {/* Cancel/Reject - for OPEN and HOLD orders */}
                  {(order.status === "OPEN" || order.status === "HOLD") && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleStatusChange("REJECTED")}
                        className="text-red-600"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Reject Order
                      </DropdownMenuItem>
                    </>
                  )}

                  {/* Delete - only for OPEN orders */}
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

        {/* Stock Shortage Alert - Only for Partial Stock */}
        {order.stockStatus === "Partial" && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 mb-2">
                  Stock Shortage Alert
                </h3>
                <p className="text-sm text-yellow-800 mb-3">
                  Some items in this order have insufficient stock. Please review the details below.
                </p>
                <div className="space-y-2">
                  {order.items
                    .filter((item) => {
                      return item.stockInfo && item.stockInfo.stockStatus !== 'Available';
                    })
                    .map((item) => {
                      const stockInfo = item.stockInfo!;
                      return (
                        <div
                          key={item.id}
                          className="bg-white rounded border border-yellow-300 p-3"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium text-gray-900">{item.item.name}</p>
                              <p className="text-xs text-gray-500">{item.item.itemCode}</p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded ${
                              stockInfo.stockStatus === 'Partial'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {stockInfo.stockStatus}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-sm">
                            <div>
                              <span className="text-gray-600">Ordered:</span>
                              <span className="ml-2 font-medium text-gray-900">
                                {stockInfo.requiredQuantity} {item.item.unit}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Available:</span>
                              <span className="ml-2 font-medium text-green-600">
                                {stockInfo.canFulfill} {item.item.unit}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Missing:</span>
                              <span className="ml-2 font-medium text-red-600">
                                {stockInfo.shortfall} {item.item.unit}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}

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
                  <TableHead className="font-semibold text-center">Stock Status</TableHead>
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
                {order.items.map((item) => {
                  const stockInfo = item.stockInfo;
                  const hasStockInfo = stockInfo !== undefined;
                  const itemHasStock = hasStockInfo ? stockInfo.stockStatus === 'Available' : item.hasStock;

                  return (
                    <TableRow
                      key={item.id}
                      className={!itemHasStock ? "bg-yellow-50" : ""}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.item.name}</p>
                          <p className="text-xs text-gray-500">
                            {item.item.itemCode}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.item.hsnCode || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(item.quantity)} {item.item.unit}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasStockInfo ? (
                          <div className="flex flex-col items-center gap-1">
                            {stockInfo.stockStatus === 'Available' && (
                              <span className="text-xs text-green-600 font-medium">
                                ✓ Available
                              </span>
                            )}
                            {stockInfo.stockStatus === 'Partial' && (
                              <div className="text-xs">
                                <span className="text-yellow-600 font-medium">
                                  ⚠ Partial
                                </span>
                                <div className="text-gray-600 mt-1">
                                  Available: {stockInfo.canFulfill} / {stockInfo.requiredQuantity}
                                </div>
                                <div className="text-red-600">
                                  Missing: {stockInfo.shortfall}
                                </div>
                              </div>
                            )}
                            {stockInfo.stockStatus === 'Unavailable' && (
                              <div className="text-xs">
                                <span className="text-red-600 font-medium">
                                  ✗ Out of Stock
                                </span>
                                <div className="text-gray-600 mt-1">
                                  Required: {stockInfo.requiredQuantity}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">
                            {item.hasStock ? "Available" : `Stock: ${item.availableStock}`}
                          </span>
                        )}
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
                  );
                })}
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
