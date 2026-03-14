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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Eye,
  ArrowRight,
  FileText,
  Filter,
  Copy,
} from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useDebounce } from "@/hooks/useDebounce";

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

interface ItemStockDetail {
  itemId: string;
  itemCode: string;
  itemName: string;
  orderedQty: number;
  availableQty: number;
  missingQty: number;
  unit: string;
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
  stockSummary?: {
    totalItems: number;
    availableItems: number;
    partialItems: number;
    unavailableItems: number;
  };
  itemStockDetails?: ItemStockDetail[];
  customer: Customer;
  items: OrderItem[];
}

const STATUS_FILTERS = [
  { value: "ALL", label: "All Orders" },
  { value: "OPEN", label: "Open" },
  { value: "HOLD", label: "Hold" },
  { value: "REJECTED", label: "Rejected" },
];

export default function SalesOrdersPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [brandFilter, setBrandFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Clipboard copy/paste
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const handleCopyOrder = (id: string) => {
    setCopiedOrderId(id);
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!copiedOrderId) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, [contextMenu]);

  // Fetch brands and customers for filters
  const { data: brandsData } = useSWR("/api/brands");
  const { data: customersData } = useSWR("/api/customers?limit=500");
  const brands = brandsData?.brands || [];
  const customers = customersData?.customers || [];

  const activeFilterCount = [brandFilter, customerFilter, dateFrom, dateTo].filter(Boolean).length;

  // Debounce search query to avoid excessive API calls
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Build API URL
  const apiUrl = useMemo(() => {
    let url = `/api/sales-orders?page=${currentPage}&limit=${itemsPerPage}`;
    if (statusFilter !== "ALL") {
      url += `&status=${statusFilter}`;
    }
    if (brandFilter) {
      url += `&brandId=${brandFilter}`;
    }
    if (customerFilter) {
      url += `&customerId=${customerFilter}`;
    }
    if (dateFrom) {
      url += `&dateFrom=${dateFrom}`;
    }
    if (dateTo) {
      url += `&dateTo=${dateTo}`;
    }
    if (debouncedSearch) {
      url += `&search=${encodeURIComponent(debouncedSearch)}`;
    }
    return url;
  }, [currentPage, statusFilter, brandFilter, customerFilter, dateFrom, dateTo, debouncedSearch]);

  // Use SWR for data fetching with caching
  const { data, error, isLoading, mutate } = useSWR(apiUrl);

  // Fetch pending reorders to show badge on affected orders
  const { data: reordersData } = useSWR("/api/reorders?status=PENDING&limit=100");
  const reorderOrderIds = useMemo(() => {
    const ids = new Set<string>();
    const reorders = reordersData?.reorders || [];
    for (const ro of reorders) {
      if (ro.salesOrders) {
        for (const sor of ro.salesOrders) {
          ids.add(sor.salesOrderId);
        }
      }
    }
    return ids;
  }, [reordersData]);

  const totalCount = data?.pagination?.total || 0;

  // Handle status filter
  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
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

      // Refresh data from cache after mutation
      mutate();
    } catch (err) {
      console.error("Error deleting order:", err);
      alert(err instanceof Error ? err.message : "Failed to delete order");
    }
  };

  // Handle create invoice - navigate to review page
  const handleCreateInvoice = (orderId: string) => {
    router.push(`/sales/invoices/new?salesOrderId=${orderId}`);
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

      // Refresh data from cache after mutation
      mutate();
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
    const salesOrders = data?.salesOrders || [];
    return {
      total: totalCount,
      open: salesOrders.filter((o: SalesOrder) => o.status === "OPEN").length,
      hold: salesOrders.filter((o: SalesOrder) => o.status === "HOLD").length,
    };
  }, [data, totalCount]);

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Sales Orders</h1>
          <p className="text-muted-foreground">
            Manage customer orders and track fulfillment status
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-border/60 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-border/60 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Open Orders</p>
                <p className="text-2xl font-bold text-foreground">{stats.open}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-border/60 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-50 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">On Hold</p>
                <p className="text-2xl font-bold text-foreground">{stats.hold}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="space-y-3 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_FILTERS.map((filter) => (
                <Button
                  key={filter.value}
                  variant={statusFilter === filter.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleStatusFilter(filter.value)}
                  className={
                    statusFilter === filter.value
                      ? "bg-primary hover:bg-primary/90"
                      : ""
                  }
                >
                  {filter.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Input
                  type="text"
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-8"
                />
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={activeFilterCount > 0 ? "border-primary text-primary" : ""}
              >
                <Filter className="h-4 w-4 mr-1" />
                Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/sales/invoices")}
              >
                <FileText className="h-4 w-4 mr-2" />
                New Invoice
              </Button>
              <Button
                onClick={() => router.push("/sales/orders/new")}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Order
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-end gap-3 p-4 bg-muted/30 rounded-xl border border-border/60">
              <div className="min-w-[160px]">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Brand</label>
                <Select value={brandFilter} onValueChange={(v) => { setBrandFilter(v === "ALL" ? "" : v); setCurrentPage(1); }}>
                  <SelectTrigger className="h-9 bg-white">
                    <SelectValue placeholder="All Brands" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Brands</SelectItem>
                    {brands.map((brand: { id: string; name: string }) => (
                      <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[200px]">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Customer</label>
                <Select value={customerFilter} onValueChange={(v) => { setCustomerFilter(v === "ALL" ? "" : v); setCurrentPage(1); }}>
                  <SelectTrigger className="h-9 bg-white">
                    <SelectValue placeholder="All Customers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Customers</SelectItem>
                    {customers.map((c: { id: string; name: string }) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[150px]">
                <label className="block text-xs font-medium text-muted-foreground mb-1">From Date</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                  className="h-9 bg-white"
                />
              </div>
              <div className="min-w-[150px]">
                <label className="block text-xs font-medium text-muted-foreground mb-1">To Date</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                  className="h-9 bg-white"
                />
              </div>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setBrandFilter("");
                    setCustomerFilter("");
                    setDateFrom("");
                    setDateTo("");
                    setCurrentPage(1);
                  }}
                  className="text-muted-foreground hover:text-foreground h-9"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Clipboard copy banner */}
        {copiedOrderId && (
          <div className="mb-3 flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-800">
            <Copy className="h-4 w-4 shrink-0" />
            <span>Order copied — right-click anywhere in the table to paste.</span>
            <button onClick={() => setCopiedOrderId(null)} className="ml-auto text-indigo-400 hover:text-indigo-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Context menu */}
        {contextMenu && (
          <div
            className="fixed z-50 min-w-[140px] rounded-lg border border-gray-200 bg-white shadow-lg py-1 text-sm"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              onClick={() => { router.push(`/sales/orders/new?copy=${copiedOrderId}`); setCopiedOrderId(null); setContextMenu(null); }}
              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700"
            >
              <Copy className="h-4 w-4" />
              Paste Order
            </button>
          </div>
        )}

        {/* Orders Table */}
        <div ref={tableRef} onContextMenu={handleContextMenu} className="rounded-xl border border-border/60 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table aria-label="Sales orders list">
              <TableHeader>
                <TableRow className="bg-muted/30">
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
                      className="text-center text-muted-foreground py-12"
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
                        <p>Error: {error.message || "Failed to load orders"}</p>
                        <Button
                          onClick={() => mutate()}
                          variant="outline"
                          size="sm"
                        >
                          Try Again
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (data?.salesOrders || []).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground py-8"
                    >
                      {searchQuery || statusFilter !== "ALL"
                        ? "No orders found matching your filters"
                        : "No sales orders yet. Click 'New Order' to create one."}
                    </TableCell>
                  </TableRow>
                ) : (
                  (data?.salesOrders || []).map((order: SalesOrder) => (
                    <TableRow key={order.id}>
                      <TableCell className="text-sm">
                        {formatDate(order.orderDate)}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() =>
                            router.push(`/sales/orders/${order.id}`)
                          }
                          className="font-medium text-primary hover:text-primary/80 hover:underline"
                        >
                          {order.orderNumber}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.customer.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {order.customer.customerNumber}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {order.referenceNumber || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <StockStatusBadge
                            status={order.stockStatus}
                            stockSummary={order.stockSummary}
                            itemStockDetails={order.itemStockDetails}
                          />
                          {reorderOrderIds.has(order.id) && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                              Reorder Pending
                            </span>
                          )}
                        </div>
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

                            {/* Edit - for OPEN and HOLD orders */}
                            {(order.status === "OPEN" || order.status === "HOLD") && (
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
                            )}

                            {/* Copy */}
                            <DropdownMenuItem onClick={() => handleCopyOrder(order.id)}>
                              <Copy className="h-4 w-4 mr-2" />
                              {copiedOrderId === order.id ? "Copied!" : "Copy Order"}
                            </DropdownMenuItem>

                            {/* Create Invoice - for all non-rejected orders */}
                            {order.status !== "REJECTED" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleCreateInvoice(order.id)}
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  Create Invoice
                                </DropdownMenuItem>
                              </>
                            )}

                            {/* Status transitions */}
                            {order.status === "OPEN" && (
                              <>
                                <DropdownMenuSeparator />
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

                            {order.status === "HOLD" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleStatusChange(order.id, "OPEN")
                                  }
                                >
                                  <ArrowRight className="h-4 w-4 mr-2" />
                                  Release Hold
                                </DropdownMenuItem>
                              </>
                            )}

                            {/* Cancel/Reject - for OPEN and HOLD orders */}
                            {(order.status === "OPEN" || order.status === "HOLD") && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleStatusChange(
                                      order.id,
                                      "REJECTED",
                                      "Order cancelled"
                                    )
                                  }
                                  className="text-red-600"
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Reject Order
                                </DropdownMenuItem>
                              </>
                            )}

                            {/* Delete - for OPEN, HOLD, and REJECTED orders */}
                            {(order.status === "OPEN" || order.status === "HOLD" || order.status === "REJECTED") && (
                              <DropdownMenuItem
                                onClick={() => handleDelete(order.id)}
                                className="text-red-600 focus:text-red-600"
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
            <p className="text-sm text-muted-foreground">
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
              <span className="text-sm text-muted-foreground">
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
