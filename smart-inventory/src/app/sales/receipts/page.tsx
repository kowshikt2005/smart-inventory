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
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  MoreHorizontal,
  Loader2,
  X,
  CreditCard,
  Eye,
  Trash2,
  Filter,
} from "lucide-react";
import { ImportButton } from "@/components/import/ImportButton";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { exportToExcel, exportToPDF, fmtDateExport, fmtNum, fetchCompanySettings } from "@/lib/export-utils";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useDebounce } from "@/hooks/useDebounce";

interface Customer {
  id: string;
  customerNumber: string;
  name: string;
}

interface PaymentAllocation {
  id: string;
  amount: number;
  invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
  };
}

interface Payment {
  id: string;
  paymentNumber: string;
  paymentDate: string;
  amount: number;
  mode: string;
  referenceNumber: string | null;
  customer: Customer;
  allocations: PaymentAllocation[];
}

const MODE_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  UPI: "UPI",
  CARD: "Card",
  OTHER: "Other",
};

export default function PaymentsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Fetch customers for filters
  const { data: customersData } = useSWR("/api/customers?limit=500");
  const customers = customersData?.customers || [];

  const activeFilterCount = [customerFilter, dateFrom, dateTo].filter(Boolean).length;

  // Debounce search
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Build API URL
  const apiUrl = useMemo(() => {
    let url = `/api/payments?page=${currentPage}&limit=${itemsPerPage}`;
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
  }, [currentPage, customerFilter, dateFrom, dateTo, debouncedSearch]);

  // Use SWR for caching
  const { data, error, isLoading, mutate } = useSWR(apiUrl);
  const payments = data?.payments || [];
  const totalCount = data?.pagination?.total || 0;

  const handleClearSearch = () => {
    setSearchQuery("");
    setCurrentPage(1);
  };

  // Handle delete/reverse payment
  const handleDelete = async (paymentId: string) => {
    if (
      !confirm(
        "Are you sure you want to reverse this payment? This will update invoice balances and ledger."
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/payments/${paymentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reverse payment");
      }

      mutate();
    } catch (err) {
      console.error("Error reversing payment:", err);
      alert(err instanceof Error ? err.message : "Failed to reverse payment");
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

  // Calculate total received
  const totalReceived = payments.reduce((sum: number, p: Payment) => sum + Number(p.amount), 0);

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Payment Receipts
          </h1>
          <p className="text-gray-600">
            Record and manage customer payments
          </p>
        </div>

        {/* Stats Cards */}
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
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CreditCard className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Received (This Page)</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(totalReceived)}
                </p>
              </div>
            </div>
          </div>
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
            <div className="flex items-center gap-2">
              <ExportButtons
                onExportExcel={async () => {
                  const { company } = await fetchCompanySettings();
                  const headers = ["Date", "Payment #", "Customer", "Mode", "Reference", "Amount"];
                  const rows = payments.map((p: Payment) => [
                    fmtDateExport(p.paymentDate),
                    p.paymentNumber,
                    p.customer.name,
                    MODE_LABELS[p.mode] || p.mode,
                    p.referenceNumber || "-",
                    Number(p.amount),
                  ]);
                  exportToExcel({ fileName: "Payment-Receipts.xlsx", sheets: [{ name: "Payments", headers, rows }], company });
                }}
                onExportPDF={async () => {
                  const { company } = await fetchCompanySettings();
                  const headers = ["Date", "Payment #", "Customer", "Mode", "Reference", "Amount"];
                  const rows = payments.map((p: Payment) => [
                    fmtDateExport(p.paymentDate),
                    p.paymentNumber,
                    p.customer.name,
                    MODE_LABELS[p.mode] || p.mode,
                    p.referenceNumber || "-",
                    fmtNum(Number(p.amount)),
                  ]);
                  exportToPDF({ fileName: "Payment-Receipts.pdf", title: "Payment Receipts", subtitle: `Generated on ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`, sheets: [{ name: "Payments", headers, rows }], company });
                }}
                disabled={isLoading || payments.length === 0}
              />
              <ImportButton entityType="PAYMENT" entityLabel="Payments" onSuccess={() => mutate()} />
              <Button
                onClick={() => router.push("/sales/receipts/new")}
                className="bg-teal-500 hover:bg-teal-600 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-end gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="min-w-[200px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Customer</label>
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

        {/* Payments Table */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table aria-label="Payments list">
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead scope="col" className="font-semibold">
                    Date
                  </TableHead>
                  <TableHead scope="col" className="font-semibold">
                    Payment #
                  </TableHead>
                  <TableHead scope="col" className="font-semibold">
                    Customer
                  </TableHead>
                  <TableHead scope="col" className="font-semibold">
                    Mode
                  </TableHead>
                  <TableHead scope="col" className="font-semibold">
                    Reference
                  </TableHead>
                  <TableHead scope="col" className="font-semibold">
                    Invoices
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
                        <span>Loading payments...</span>
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
                        <p>Error: {error?.message || "Failed to load payments"}</p>
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
                ) : payments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-gray-500 py-8"
                    >
                      {searchQuery
                        ? "No payments found matching your search"
                        : "No payments recorded yet. Click 'Record Payment' to add one."}
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment: Payment) => (
                    <TableRow key={payment.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm">
                        {formatDate(payment.paymentDate)}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-teal-600">
                          {payment.paymentNumber}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{payment.customer.name}</p>
                          <p className="text-xs text-gray-500">
                            {payment.customer.customerNumber}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {MODE_LABELS[payment.mode] || payment.mode}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {payment.referenceNumber || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {payment.allocations.slice(0, 2).map((alloc: PaymentAllocation) => (
                            <Badge
                              key={alloc.id}
                              variant="secondary"
                              className="text-xs"
                            >
                              {alloc.invoice.invoiceNumber}
                            </Badge>
                          ))}
                          {payment.allocations.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{payment.allocations.length - 2} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {formatCurrency(Number(payment.amount))}
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
                                router.push(`/sales/receipts/${payment.id}`)
                              }
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(payment.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Reverse Payment
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
              {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount}{" "}
              payments
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
