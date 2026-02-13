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
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MoreHorizontal,
  Loader2,
  X,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  CreditCard,
  Ban,
  Filter,
} from "lucide-react";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

interface Customer {
  id: string;
  customerNumber: string;
  name: string;
  gstin: string | null;
  city: string | null;
  state: string | null;
  creditDays: number;
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
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: string;
  effectiveStatus: string;
  customer: Customer;
}

const STATUS_FILTERS = [
  { value: "ALL", label: "All Invoices" },
  { value: "PENDING", label: "Pending" },
  { value: "PARTIAL", label: "Partial" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "CANCELLED", label: "Cancelled" },
];

interface Brand {
  id: string;
  name: string;
}

export default function SalesInvoicesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [brandFilter, setBrandFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [serverStats, setServerStats] = useState<{
    total: number;
    pending: number;
    overdue: number;
    paid: number;
    totalReceivable: number;
  } | null>(null);
  const itemsPerPage = 15;

  // Fetch brands and customers for filters
  const { data: brandsData } = useSWR("/api/brands");
  const { data: customersData } = useSWR("/api/customers?limit=500");
  const brands: Brand[] = brandsData?.brands || [];
  const customers = customersData?.customers || [];

  const activeFilterCount = [brandFilter, customerFilter, dateFrom, dateTo].filter(Boolean).length;

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let url = `/api/sales-invoices?page=${currentPage}&limit=${itemsPerPage}`;
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
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch invoices");
      }

      const data = await response.json();
      setInvoices(data.invoices || []);
      setTotalCount(data.pagination?.total || 0);
      // Use server-calculated stats
      if (data.stats) {
        setServerStats(data.stats);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("Error fetching invoices:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, statusFilter, brandFilter, customerFilter, dateFrom, dateTo, searchQuery]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Handle search
  const handleSearch = () => {
    setCurrentPage(1);
    fetchInvoices();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setCurrentPage(1);
    fetchInvoices();
  };

  // Handle status filter
  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  // Handle cancel invoice
  const handleCancel = async (invoiceId: string) => {
    if (!confirm("Are you sure you want to cancel this invoice? This will reverse the ledger entry.")) {
      return;
    }

    try {
      const response = await fetch(`/api/sales-invoices/${invoiceId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel invoice");
      }

      fetchInvoices();
    } catch (err) {
      console.error("Error cancelling invoice:", err);
      alert(err instanceof Error ? err.message : "Failed to cancel invoice");
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
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // Use server stats or fall back to client calculation
  const stats = useMemo(() => {
    if (serverStats) {
      return serverStats;
    }
    // Fallback to client-side calculation
    const pending = invoices.filter(
      (i) => i.effectiveStatus === "PENDING"
    ).length;
    const overdue = invoices.filter(
      (i) => i.effectiveStatus === "OVERDUE"
    ).length;
    const paid = invoices.filter((i) => i.effectiveStatus === "PAID").length;
    const totalReceivable = invoices
      .filter((i) => i.effectiveStatus !== "PAID" && i.effectiveStatus !== "CANCELLED")
      .reduce((sum, i) => sum + Number(i.balanceAmount), 0);

    return {
      total: totalCount,
      pending,
      overdue,
      paid,
      totalReceivable,
    };
  }, [invoices, totalCount, serverStats]);

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Sales Invoices
          </h1>
          <p className="text-gray-600">
            Manage customer invoices and track payments
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Invoices</p>
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
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-2xl font-bold text-gray-900">{stats.overdue}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Receivable</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(stats.totalReceivable)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="space-y-3 mb-6">
          {/* Row 1: Status + Search */}
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
                  placeholder="Search invoices..."
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={activeFilterCount > 0 ? "border-teal-500 text-teal-600" : ""}
              >
                <Filter className="h-4 w-4 mr-1" />
                Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
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
                    {brands.map((brand: Brand) => (
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

        {/* Invoices Table */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table aria-label="Sales invoices list">
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead scope="col" className="font-semibold">
                    Invoice Date
                  </TableHead>
                  <TableHead scope="col" className="font-semibold">
                    Invoice #
                  </TableHead>
                  <TableHead scope="col" className="font-semibold">
                    Order #
                  </TableHead>
                  <TableHead scope="col" className="font-semibold">
                    Customer
                  </TableHead>
                  <TableHead scope="col" className="font-semibold">
                    Due Date
                  </TableHead>
                  <TableHead scope="col" className="font-semibold text-center">
                    Status
                  </TableHead>
                  <TableHead scope="col" className="font-semibold text-right">
                    Total
                  </TableHead>
                  <TableHead scope="col" className="font-semibold text-right">
                    Balance
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
                      colSpan={9}
                      className="text-center text-gray-500 py-12"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Loading invoices...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-red-600 py-8"
                    >
                      <div className="space-y-2">
                        <p>Error: {error}</p>
                        <Button
                          onClick={fetchInvoices}
                          variant="outline"
                          size="sm"
                        >
                          Try Again
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : invoices.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-gray-500 py-8"
                    >
                      {searchQuery || statusFilter !== "ALL"
                        ? "No invoices found matching your filters"
                        : "No invoices yet. Create invoices from delivered sales orders."}
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((invoice) => (
                    <TableRow key={invoice.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm">
                        {formatDate(invoice.invoiceDate)}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() =>
                            router.push(`/sales/invoices/${invoice.id}`)
                          }
                          className="font-medium text-teal-600 hover:text-teal-800 hover:underline"
                        >
                          {invoice.invoiceNumber}
                        </button>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {invoice.orderNumber || "-"}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{invoice.customer.name}</p>
                          <p className="text-xs text-gray-500">
                            {invoice.customer.customerNumber}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(invoice.dueDate)}
                      </TableCell>
                      <TableCell className="text-center">
                        <InvoiceStatusBadge status={invoice.effectiveStatus} />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(invoice.totalAmount))}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            Number(invoice.balanceAmount) > 0
                              ? "text-red-600 font-medium"
                              : "text-green-600"
                          }
                        >
                          {formatCurrency(Number(invoice.balanceAmount))}
                        </span>
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
                                router.push(`/sales/invoices/${invoice.id}`)
                              }
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {invoice.effectiveStatus !== "PAID" &&
                              invoice.effectiveStatus !== "CANCELLED" && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      router.push(
                                        `/sales/receipts/new?customerId=${invoice.customer.id}`
                                      )
                                    }
                                  >
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    Record Payment
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleCancel(invoice.id)}
                                    className="text-red-600"
                                  >
                                    <Ban className="h-4 w-4 mr-2" />
                                    Cancel Invoice
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
              invoices
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
