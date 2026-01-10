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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SalesOrderStatusBadge } from "@/components/sales-orders/SalesOrderStatusBadge";
import { StockStatusBadge } from "@/components/sales-orders/StockStatusBadge";
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  X,
  ShoppingCart,
  Clock,
  Truck,
  CheckCircle2,
  Eye,
  ArrowRight,
} from "lucide-react";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

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
  };
}

interface SalesOrder {
  id: string;
  orderNumber: string;
  orderDate: string;
  customerId: string;
  referenceNumber: string | null;
  status: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  stockStatus: "Available" | "Partial" | "Unavailable";
  customer: Customer;
  items: OrderItem[];
}

const STATUS_FILTERS = [
  { value: "ALL", label: "All Orders" },
  { value: "OPEN", label: "Open" },
  { value: "DELIVER", label: "Ready" },
  { value: "HOLD", label: "On Hold" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "REJECT", label: "Rejected" },
];

export default function SalesOrdersPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 15;

  // Fetch sales orders
  const fetchSalesOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let url = `/api/sales-orders?page=${currentPage}&limit=${itemsPerPage}`;
      if (statusFilter !== "ALL") {
        url += `&status=${statusFilter}`;
      }
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch sales orders");
      }

      const data = await response.json();
      setSalesOrders(data.salesOrders || []);
      setTotalCount(data.pagination?.total || 0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("Error fetching sales orders:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, statusFilter, searchQuery]);

  useEffect(() => {
    fetchSalesOrders();
  }, [fetchSalesOrders]);

  // Handle search
  const handleSearch = () => {
    setCurrentPage(1);
    fetchSalesOrders();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setCurrentPage(1);
    fetchSalesOrders();
  };

  // Handle status filter
  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  // Handle delete
  const handleDelete = async (orderId: string) => {
    if (!confirm("Are you sure you want to delete this order?")) {
      return;
    }

    try {
      const response = await fetch(`/api/sales-orders/${orderId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete order");
      }

      fetchSalesOrders();
    } catch (err) {
      console.error("Error deleting order:", err);
      alert(err instanceof Error ? err.message : "Failed to delete order");
    }
  };

  // Handle status change
  const handleStatusChange = async (
    orderId: string,
    newStatus: string,
    reason?: string
  ) => {
    try {
      const response = await fetch(`/api/sales-orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, reason }),
      });

      const data = await response.json();

      if (response.status === 409 && data.warning) {
        // Stock warning
        interface StockItem {
          itemName: string;
          required: number;
          available: number;
        }
        const proceed = confirm(
          `Warning: Some items have insufficient stock.\n\n${data.insufficientStock
            .map(
              (item: StockItem) =>
                `${item.itemName}: Need ${item.required}, Available ${item.available}`
            )
            .join("\n")}\n\nDo you want to proceed anyway?`
        );

        if (proceed) {
          // Force the status change
          await fetch(`/api/sales-orders/${orderId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus, reason, force: true }),
          });
        }
      }

      if (!response.ok && !data.warning) {
        throw new Error(data.error || "Failed to change status");
      }

      fetchSalesOrders();
    } catch (err) {
      console.error("Error changing status:", err);
      alert(err instanceof Error ? err.message : "Failed to change status");
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // Calculate stats
  const stats = useMemo(() => {
    return {
      total: totalCount,
      open: salesOrders.filter((o) => o.status === "OPEN").length,
      ready: salesOrders.filter((o) => o.status === "DELIVER").length,
      delivered: salesOrders.filter((o) => o.status === "DELIVERED").length,
    };
  }, [salesOrders, totalCount]);

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Sales Orders</h1>
          <p className="text-gray-600">
            Manage customer orders and track fulfillment status
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Open Orders</p>
                <p className="text-2xl font-bold text-gray-900">{stats.open}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Truck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Ready for Delivery</p>
                <p className="text-2xl font-bold text-gray-900">{stats.ready}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Delivered</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.delivered}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter Buttons */}
            {STATUS_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                variant={statusFilter === filter.value ? "default" : "outline"}
                size="sm"
                onClick={() => handleStatusFilter(filter.value)}
                className={
                  statusFilter === filter.value
                    ? "bg-teal-500 hover:bg-teal-600"
                    : ""
                }
              >
                {filter.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative w-64">
              <Input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="pr-8"
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button onClick={handleSearch} variant="outline" size="sm">
              Search
            </Button>
            {/* New Order Button */}
            <Button
              onClick={() => router.push("/sales/orders/new")}
              className="bg-teal-500 hover:bg-teal-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Order
            </Button>
          </div>
        </div>

        {/* Orders Table */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table aria-label="Sales orders list">
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead scope="col" className="font-semibold">
                    Date
                  </TableHead>
                  <TableHead scope="col" className="font-semibold">
                    Order #
                  </TableHead>
                  <TableHead scope="col" className="font-semibold">
                    Customer
                  </TableHead>
                  <TableHead scope="col" className="font-semibold">
                    Reference
                  </TableHead>
                  <TableHead scope="col" className="font-semibold text-center">
                    Stock Status
                  </TableHead>
                  <TableHead scope="col" className="font-semibold text-center">
                    Order Status
                  </TableHead>
                  <TableHead scope="col" className="font-semibold text-right">
                    Total Amount
                  </TableHead>
                  <TableHead scope="col" className="font-semibold">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-gray-500 py-12"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Loading orders...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-red-600 py-8"
                    >
                      <div className="space-y-2">
                        <p>Error: {error}</p>
                        <Button
                          onClick={fetchSalesOrders}
                          variant="outline"
                          size="sm"
                        >
                          Try Again
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : salesOrders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-gray-500 py-8"
                    >
                      {searchQuery || statusFilter !== "ALL"
                        ? "No orders found matching your filters"
                        : "No sales orders yet. Click 'New Order' to create one."}
                    </TableCell>
                  </TableRow>
                ) : (
                  salesOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm">
                        {formatDate(order.orderDate)}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() =>
                            router.push(`/sales/orders/${order.id}`)
                          }
                          className="font-medium text-teal-600 hover:text-teal-800 hover:underline"
                        >
                          {order.orderNumber}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.customer.name}</p>
                          <p className="text-xs text-gray-500">
                            {order.customer.customerNumber}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {order.referenceNumber || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <StockStatusBadge status={order.stockStatus} />
                      </TableCell>
                      <TableCell className="text-center">
                        <SalesOrderStatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(order.totalAmount))}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              aria-label="Actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/sales/orders/${order.id}`)
                              }
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {order.status === "OPEN" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() =>
                                    router.push(
                                      `/sales/orders/new?edit=${order.id}`
                                    )
                                  }
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Order
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleStatusChange(order.id, "DELIVER")
                                  }
                                >
                                  <ArrowRight className="h-4 w-4 mr-2" />
                                  Mark as Ready
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleStatusChange(order.id, "HOLD")
                                  }
                                >
                                  <Clock className="h-4 w-4 mr-2" />
                                  Put on Hold
                                </DropdownMenuItem>
                              </>
                            )}
                            {order.status === "DELIVER" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleStatusChange(order.id, "DELIVERED")
                                  }
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Mark as Delivered
                                </DropdownMenuItem>
                              </>
                            )}
                            {order.status === "HOLD" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleStatusChange(order.id, "DELIVER")
                                  }
                                >
                                  <ArrowRight className="h-4 w-4 mr-2" />
                                  Release Hold
                                </DropdownMenuItem>
                              </>
                            )}
                            {(order.status === "OPEN" ||
                              order.status === "HOLD" ||
                              order.status === "DELIVER") && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleStatusChange(
                                      order.id,
                                      "REJECT",
                                      "Order cancelled"
                                    )
                                  }
                                  className="text-red-600"
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Cancel Order
                                </DropdownMenuItem>
                              </>
                            )}
                            {order.status === "OPEN" && (
                              <DropdownMenuItem
                                onClick={() => handleDelete(order.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Order
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount}{" "}
              orders
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
