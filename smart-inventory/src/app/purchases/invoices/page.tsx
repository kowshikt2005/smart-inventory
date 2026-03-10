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
import { PurchaseInvoiceStatusBadge } from "@/components/purchase-orders/PurchaseOrderStatusBadge";
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  X,
  FileText,
  Clock,
  Eye,
  CheckCircle,
  CreditCard,
  AlertCircle,
  Filter,
} from "lucide-react";
import { ImportButton } from "@/components/import/ImportButton";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { exportToExcel, exportToPDF, fmtDateExport, fmtNum, fetchCompanySettings } from "@/lib/export-utils";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useDebounce } from "@/hooks/useDebounce";

interface Vendor {
  id: string;
  vendorNumber: string;
  name: string;
}

interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  vendorId: string;
  vendorName: string;
  status: string;
  effectiveStatus: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  ref: string | null;
  isImported: boolean;
  vendor: Vendor | null;
  purchaseOrder?: { id: string; orderNumber: string } | null;
}

const STATUS_FILTERS = [
  { value: "ALL", label: "All Invoices" },
  { value: "PENDING", label: "Pending" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "CANCELLED", label: "Cancelled" },
];

interface Brand {
  id: string;
  name: string;
}

export default function PurchaseInvoicesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [brandFilter, setBrandFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch brands and vendors for filters
  const { data: brandsData } = useSWR("/api/brands");
  const { data: vendorsData } = useSWR("/api/vendors?limit=500");
  const brands: Brand[] = brandsData?.brands || [];
  const vendors = vendorsData?.vendors || [];

  const activeFilterCount = [brandFilter, vendorFilter, dateFrom, dateTo].filter(Boolean).length;

  const apiUrl = useMemo(() => {
    let url = `/api/purchase-invoices?page=${currentPage}&limit=${itemsPerPage}`;
    if (statusFilter !== "ALL") {
      url += `&status=${statusFilter}`;
    }
    if (brandFilter) {
      url += `&brandId=${brandFilter}`;
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
    if (debouncedSearch) {
      url += `&search=${encodeURIComponent(debouncedSearch)}`;
    }
    return url;
  }, [currentPage, statusFilter, brandFilter, vendorFilter, dateFrom, dateTo, debouncedSearch]);

  const { data, error, isLoading, mutate } = useSWR(apiUrl);

  const totalCount = data?.pagination?.total || 0;

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  const handleDelete = async (invoiceId: string) => {
    if (!confirm("Are you sure you want to delete this invoice?")) {
      return;
    }

    try {
      const response = await fetch(`/api/purchase-invoices/${invoiceId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete invoice");
      }

      mutate();
    } catch (err) {
      console.error("Error deleting invoice:", err);
      alert(err instanceof Error ? err.message : "Failed to delete invoice");
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

  const stats = useMemo(() => {
    if (data?.stats) {
      return data.stats;
    }
    // Fallback to client-side calculation
    const invoices = data?.purchaseInvoices || [];
    return {
      total: totalCount,
      pending: invoices.filter((i: PurchaseInvoice) => i.effectiveStatus === "PENDING").length,
      paid: invoices.filter((i: PurchaseInvoice) => i.effectiveStatus === "PAID").length,
      overdue: invoices.filter((i: PurchaseInvoice) => i.effectiveStatus === "OVERDUE").length,
      totalPayable: invoices
        .filter((i: PurchaseInvoice) => i.effectiveStatus !== "PAID" && i.effectiveStatus !== "CANCELLED")
        .reduce((sum: number, i: PurchaseInvoice) => sum + Number(i.balanceAmount), 0),
    };
  }, [data, totalCount]);

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Purchase Invoices</h1>
          <p className="text-gray-600">Manage vendor invoices and payments</p>
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
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Paid</p>
                <p className="text-2xl font-bold text-gray-900">{stats.paid}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Payable</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(stats.totalPayable || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="space-y-3 mb-6">
          {/* Row 1: Status + Search + New */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_FILTERS.map((filter) => (
                <Button
                  key={filter.value}
                  variant={statusFilter === filter.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleStatusFilter(filter.value)}
                  className={statusFilter === filter.value ? "bg-teal-500 hover:bg-teal-600" : ""}
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
              <ExportButtons
                onExportExcel={async () => {
                  const { company } = await fetchCompanySettings();
                  const piList = data?.purchaseInvoices || [];
                  const headers = ["Date", "Invoice #", "Vendor", "Due Date", "Status", "Amount", "Tax", "Total", "Paid", "Balance"];
                  const rows = piList.map((i: PurchaseInvoice) => [
                    fmtDateExport(i.date),
                    i.invoiceNumber,
                    i.vendorName,
                    fmtDateExport(i.dueDate),
                    i.effectiveStatus,
                    Number(i.amount),
                    Number(i.taxAmount),
                    Number(i.totalAmount),
                    Number(i.paidAmount),
                    Number(i.balanceAmount),
                  ]);
                  exportToExcel({ fileName: "Purchase-Invoices.xlsx", sheets: [{ name: "Purchase Invoices", headers, rows }], company });
                }}
                onExportPDF={async () => {
                  const { company } = await fetchCompanySettings();
                  const piList = data?.purchaseInvoices || [];
                  const headers = ["Date", "Invoice #", "Vendor", "Status", "Total", "Balance"];
                  const rows = piList.map((i: PurchaseInvoice) => [
                    fmtDateExport(i.date),
                    i.invoiceNumber,
                    i.vendorName,
                    i.effectiveStatus,
                    fmtNum(Number(i.totalAmount)),
                    fmtNum(Number(i.balanceAmount)),
                  ]);
                  exportToPDF({ fileName: "Purchase-Invoices.pdf", title: "Purchase Invoices", subtitle: `Generated on ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`, orientation: "landscape", sheets: [{ name: "Purchase Invoices", headers, rows }], company });
                }}
                disabled={isLoading || (data?.purchaseInvoices || []).length === 0}
              />
              <ImportButton entityType="PURCHASE_INVOICE" entityLabel="Purchase Invoices" onSuccess={() => mutate()} />
              <Button
                onClick={() => router.push("/purchases/invoices/new")}
                className="bg-teal-500 hover:bg-teal-600 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Invoice
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
                <label className="block text-xs font-medium text-gray-600 mb-1">Vendor</label>
                <Select value={vendorFilter} onValueChange={(v) => { setVendorFilter(v === "ALL" ? "" : v); setCurrentPage(1); }}>
                  <SelectTrigger className="h-9 bg-white">
                    <SelectValue placeholder="All Vendors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Vendors</SelectItem>
                    {vendors.map((v: { id: string; name: string }) => (
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
                    setBrandFilter("");
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

        {/* Invoices Table */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Invoice #</TableHead>
                  <TableHead className="font-semibold">Vendor</TableHead>
                  <TableHead className="font-semibold">Due Date</TableHead>
                  <TableHead className="font-semibold text-center">Status</TableHead>
                  <TableHead className="font-semibold text-right">Total</TableHead>
                  <TableHead className="font-semibold text-right">Balance</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 py-12">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Loading invoices...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-red-600 py-8">
                      <p>Error: {error.message || "Failed to load invoices"}</p>
                      <Button onClick={() => mutate()} variant="outline" size="sm" className="mt-2">
                        Try Again
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (data?.purchaseInvoices || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                      {searchQuery || statusFilter !== "ALL"
                        ? "No invoices found matching your filters"
                        : "No purchase invoices yet. Click 'New Invoice' to create one."}
                    </TableCell>
                  </TableRow>
                ) : (
                  (data?.purchaseInvoices || []).map((invoice: PurchaseInvoice) => (
                    <TableRow key={invoice.id} className={invoice.isImported ? "bg-yellow-50 hover:bg-yellow-100" : "hover:bg-gray-50"}>
                      <TableCell className="text-sm">{formatDate(invoice.date)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => router.push(`/purchases/invoices/${invoice.id}`)}
                            className="font-medium text-teal-600 hover:text-teal-800 hover:underline"
                          >
                            {invoice.invoiceNumber}
                          </button>
                          {invoice.ref && (
                            <span className="inline-flex items-center rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 ring-1 ring-inset ring-purple-200">
                              {invoice.ref}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{invoice.vendor?.name || invoice.vendorName}</p>
                          <p className="text-xs text-gray-500">{invoice.vendor?.vendorNumber || ''}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDate(invoice.dueDate)}
                      </TableCell>
                      <TableCell className="text-center">
                        <PurchaseInvoiceStatusBadge status={invoice.effectiveStatus} />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(invoice.totalAmount))}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {Number(invoice.balanceAmount) > 0 ? (
                          <span className="text-red-600">
                            {formatCurrency(Number(invoice.balanceAmount))}
                          </span>
                        ) : (
                          <span className="text-green-600">Paid</span>
                        )}
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
                              onClick={() => router.push(`/purchases/invoices/${invoice.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>

                            {invoice.effectiveStatus === "PENDING" && (
                              <DropdownMenuItem
                                onClick={() => router.push(`/purchases/invoices/new?edit=${invoice.id}`)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Invoice
                              </DropdownMenuItem>
                            )}

                            {invoice.effectiveStatus !== "PAID" && invoice.effectiveStatus !== "CANCELLED" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    router.push(`/purchases/payments/new?purchaseInvoiceId=${invoice.id}`)
                                  }
                                >
                                  <CreditCard className="h-4 w-4 mr-2" />
                                  Make Payment
                                </DropdownMenuItem>
                              </>
                            )}

                            {invoice.effectiveStatus === "PENDING" && (
                              <DropdownMenuItem
                                onClick={() => handleDelete(invoice.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Invoice
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
              {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} invoices
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
