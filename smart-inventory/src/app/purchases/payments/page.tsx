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
import { Plus, MoreHorizontal, Trash2, Loader2, X, Eye, CreditCard, Wallet, Filter } from "lucide-react";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useDebounce } from "@/hooks/useDebounce";

interface VendorPayment {
  id: string;
  paymentNumber: string;
  date: string;
  vendorId: string;
  purchaseInvoiceId: string | null;
  amount: number;
  mode: string;
  paidFrom: string;
  reference: string | null;
  vendor: {
    id: string;
    vendorNumber: string;
    name: string;
  };
  purchaseInvoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    balanceAmount: number;
  } | null;
}

type PaymentFilter = "all" | "invoice" | "advance";

export default function VendorPaymentsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [vendorFilter, setVendorFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const itemsPerPage = 15;

  // Fetch vendors for filters
  const { data: vendorsData } = useSWR("/api/vendors?limit=500");
  const vendors = vendorsData?.vendors || [];

  const activeFilterCount = [vendorFilter, dateFrom, dateTo].filter(Boolean).length;

  const debouncedSearch = useDebounce(searchQuery, 300);

  const apiUrl = useMemo(() => {
    let url = `/api/vendor-payments?page=${currentPage}&limit=${itemsPerPage}`;
    if (debouncedSearch) {
      url += `&search=${encodeURIComponent(debouncedSearch)}`;
    }
    if (paymentFilter !== "all") {
      url += `&type=${paymentFilter}`;
    }
    if (vendorFilter) {
      url += `&vendorId=${vendorFilter}`;
    }
    if (dateFrom) {
      url += `&dateFrom=${dateFrom}`;
    }
    if (dateTo) {
      url += `&dateTo=${dateTo}`;
    }
    return url;
  }, [currentPage, debouncedSearch, paymentFilter, vendorFilter, dateFrom, dateTo]);

  const { data, error, isLoading, mutate } = useSWR(apiUrl);

  const totalCount = data?.pagination?.total || 0;

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  const handleDelete = async (paymentId: string) => {
    if (!confirm("Are you sure you want to delete this payment?")) {
      return;
    }

    try {
      const response = await fetch(`/api/vendor-payments/${paymentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete payment");
      }

      mutate();
    } catch (err) {
      console.error("Error deleting payment:", err);
      alert(err instanceof Error ? err.message : "Failed to delete payment");
    }
  };

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

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Vendor Payments</h1>
          <p className="text-gray-600">Manage payments to vendors</p>
        </div>

        {/* Stats Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CreditCard className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Payments</p>
                <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setPaymentFilter("all"); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              paymentFilter === "all"
                ? "bg-teal-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All Payments
          </button>
          <button
            onClick={() => { setPaymentFilter("invoice"); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              paymentFilter === "invoice"
                ? "bg-teal-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Invoice Payments
          </button>
          <button
            onClick={() => { setPaymentFilter("advance"); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              paymentFilter === "advance"
                ? "bg-teal-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Wallet className="h-4 w-4 inline mr-1" />
            Advance Payments
          </button>
        </div>

        {/* Search and Actions */}
        <div className="space-y-3 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Input
                  type="text"
                  placeholder="Search payments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-8"
                />
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
            <Button
              onClick={() => router.push("/purchases/payments/new")}
              className="bg-teal-500 hover:bg-teal-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Payment
            </Button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-end gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="min-w-[200px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Vendor</label>
                <Select value={vendorFilter} onValueChange={(v) => { setVendorFilter(v === "ALL" ? "" : v); setCurrentPage(1); }}>
                  <SelectTrigger className="h-9 bg-white">
                    <SelectValue placeholder="All Vendors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Vendors</SelectItem>
                    {vendors.map((v: any) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
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
                    setVendorFilter("");
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

        {/* Payments Table */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Payment #</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold">Vendor</TableHead>
                  <TableHead className="font-semibold">Invoice #</TableHead>
                  <TableHead className="font-semibold">Mode</TableHead>
                  <TableHead className="font-semibold text-right">Amount</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 py-12">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Loading payments...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-red-600 py-8">
                      <p>Error: {error.message || "Failed to load payments"}</p>
                      <Button onClick={() => mutate()} variant="outline" size="sm" className="mt-2">
                        Try Again
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (data?.vendorPayments || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                      {searchQuery ? "No payments found" : "No vendor payments yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  (data?.vendorPayments || []).map((payment: VendorPayment) => (
                    <TableRow key={payment.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm">{formatDate(payment.date)}</TableCell>
                      <TableCell>
                        <button
                          onClick={() => router.push(`/purchases/payments/${payment.id}`)}
                          className="font-medium text-teal-600 hover:text-teal-800 hover:underline"
                        >
                          {payment.paymentNumber}
                        </button>
                      </TableCell>
                      <TableCell>
                        {payment.purchaseInvoice ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            Invoice
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                            <Wallet className="h-3 w-3 mr-1" />
                            Advance
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{payment.vendor.name}</p>
                          <p className="text-xs text-gray-500">{payment.vendor.vendorNumber}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {payment.purchaseInvoice ? (
                          <button
                            onClick={() => router.push(`/purchases/invoices/${payment.purchaseInvoice!.id}`)}
                            className="text-teal-600 hover:underline"
                          >
                            {payment.purchaseInvoice.invoiceNumber}
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{payment.mode}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(payment.amount))}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => router.push(`/purchases/payments/${payment.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(payment.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Payment
                            </DropdownMenuItem>
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
              {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} payments
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
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
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
