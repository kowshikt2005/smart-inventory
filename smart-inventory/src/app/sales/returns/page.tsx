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
import { ReturnStatusBadge } from "@/components/sales-returns/ReturnStatusBadge";
import {
  Plus,
  MoreHorizontal,
  Loader2,
  X,
  RotateCcw,
  Eye,
  CheckCircle2,
  Ban,
  Filter,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useDebounce } from "@/hooks/useDebounce";

interface Customer {
  id: string;
  customerNumber: string;
  name: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
}

interface SalesReturn {
  id: string;
  returnNumber: string;
  returnDate: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  reason: string | null;
  status: string;
  customer: Customer;
  invoice: Invoice | null;
}

const STATUS_FILTERS = [
  { value: "ALL", label: "All Returns" },
  { value: "OPEN", label: "Open" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function SalesReturnsPage() {
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

  // Fetch brands and customers for filters
  const { data: brandsData } = useSWR("/api/brands");
  const { data: customersData } = useSWR("/api/customers?limit=500");
  const brands = brandsData?.brands || [];
  const customers = customersData?.customers || [];

  const activeFilterCount = [brandFilter, customerFilter, dateFrom, dateTo].filter(Boolean).length;

  // Debounce search
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Build API URL
  const apiUrl = useMemo(() => {
    let url = `/api/sales-returns?page=${currentPage}&limit=${itemsPerPage}`;
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

  // Use SWR for caching
  const { data, error, isLoading, mutate } = useSWR(apiUrl);
  const totalCount = data?.pagination?.total || 0;

  const handleClearSearch = () => {
    setSearchQuery("");
    setCurrentPage(1);
  };

  // Handle status filter
  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  // Handle complete
  const handleComplete = async (returnId: string) => {
    if (
      !confirm(
        "Complete this return? This will restore inventory and create a credit ledger entry."
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/sales-returns/${returnId}/complete`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to complete return");
      }

      mutate();
    } catch (err) {
      console.error("Error completing return:", err);
      alert(err instanceof Error ? err.message : "Failed to complete return");
    }
  };

  // Handle cancel
  const handleCancel = async (returnId: string) => {
    if (!confirm("Are you sure you want to cancel this return?")) {
      return;
    }

    try {
      const response = await fetch(`/api/sales-returns/${returnId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel return");
      }

      mutate();
    } catch (err) {
      console.error("Error cancelling return:", err);
      alert(err instanceof Error ? err.message : "Failed to cancel return");
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
    const salesReturns = data?.salesReturns || [];
    const open = salesReturns.filter((r: SalesReturn) => r.status === "OPEN").length;
    const completed = salesReturns.filter((r: SalesReturn) => r.status === "COMPLETED").length;
    const totalValue = salesReturns
      .filter((r: SalesReturn) => r.status === "COMPLETED")
      .reduce((sum: number, r: SalesReturn) => sum + Number(r.totalAmount), 0);

    return {
      total: totalCount,
      open,
      completed,
      totalValue,
    };
  }, [data, totalCount]);

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Sales Returns
          </h1>
          <p className="text-gray-600">
            Manage goods returned by customers
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <RotateCcw className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Returns</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <RotateCcw className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Open Returns</p>
                <p className="text-2xl font-bold text-gray-900">{stats.open}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.completed}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <RotateCcw className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(stats.totalValue)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="space-y-3 mb-6">
          {/* Row 1: Status + Search + Filters + New */}
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
                      ? "bg-teal-500 hover:bg-teal-600"
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
                  placeholder="Search returns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={activeFilterCount > 0 ? "border-teal-500 text-teal-600" : ""}
              >
                <Filter className="h-4 w-4 mr-1" />
                Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
              </Button>
              <Button
                onClick={() => router.push("/sales/returns/new")}
                className="bg-teal-500 hover:bg-teal-600 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Return
              </Button>
            </div>
          </div>

          {/* Row 2: Advanced Filters (collapsible) */}
          {showFilters && (
            <div className="flex flex-wrap items-end gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="min-w-[160px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Brand</label>
                <Select value={brandFilter} onValueChange={(v) => { setBrandFilter(v === "ALL" ? "" : v); setCurrentPage(1); }}>
                  <SelectTrigger className="h-9 bg-white">
                    <SelectValue placeholder="All Brands" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Brands</SelectItem>
                    {brands.map((brand: any) => (
                      <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[200px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Customer</label>
                <Select value={customerFilter} onValueChange={(v) => { setCustomerFilter(v === "ALL" ? "" : v); setCurrentPage(1); }}>
                  <SelectTrigger className="h-9 bg-white">
                    <SelectValue placeholder="All Customers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Customers</SelectItem>
                    {customers.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[150px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                  className="h-9 bg-white"
                />
              </div>
              <div className="min-w-[150px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
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
                  className="text-gray-500 hover:text-gray-700 h-9"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Returns Table */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table aria-label="Sales returns list">
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead scope="col" className="font-semibold">
                    Date
                  </TableHead>
                  <TableHead scope="col" className="font-semibold">
                    Return #
                  </TableHead>
                  <TableHead scope="col" className="font-semibold">
                    Customer
                  </TableHead>
                  <TableHead scope="col" className="font-semibold">
                    Invoice
                  </TableHead>
                  <TableHead scope="col" className="font-semibold">
                    Reason
                  </TableHead>
                  <TableHead scope="col" className="font-semibold text-center">
                    Status
                  </TableHead>
                  <TableHead scope="col" className="font-semibold text-right">
                    Amount
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
                        <span>Loading returns...</span>
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
                        <p>Error: {error?.message || "Failed to load returns"}</p>
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
                ) : (data?.salesReturns || []).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-gray-500 py-8"
                    >
                      {searchQuery || statusFilter !== "ALL"
                        ? "No returns found matching your filters"
                        : "No sales returns yet. Click 'New Return' to create one."}
                    </TableCell>
                  </TableRow>
                ) : (
                  (data?.salesReturns || []).map((ret: SalesReturn) => (
                    <TableRow key={ret.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm">
                        {formatDate(ret.returnDate)}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() =>
                            router.push(`/sales/returns/${ret.id}`)
                          }
                          className="font-medium text-teal-600 hover:text-teal-800 hover:underline"
                        >
                          {ret.returnNumber}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{ret.customer.name}</p>
                          <p className="text-xs text-gray-500">
                            {ret.customer.customerNumber}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {ret.invoice ? (
                          <button
                            onClick={() =>
                              router.push(`/sales/invoices/${ret.invoice!.id}`)
                            }
                            className="text-teal-600 hover:underline"
                          >
                            {ret.invoice.invoiceNumber}
                          </button>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">
                        {ret.reason || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <ReturnStatusBadge status={ret.status} />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(ret.totalAmount))}
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
                                router.push(`/sales/returns/${ret.id}`)
                              }
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {ret.status === "OPEN" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleComplete(ret.id)}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Complete Return
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleCancel(ret.id)}
                                  className="text-red-600"
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Cancel Return
                                </DropdownMenuItem>
                              </>
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
              returns
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
