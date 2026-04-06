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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Edit,
  Loader2,
  X,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  CreditCard,
  Trash2,
  Filter,
  FileDown,
  Copy,
  MoreVertical,
  Plus,
} from "lucide-react";
import { ImportButton } from "@/components/import/ImportButton";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { exportToExcel, exportToPDF, fmtDateExport, fmtNum, fetchCompanySettings } from "@/lib/export-utils";
import { generateInvoicePDF } from "@/lib/invoice-pdf";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
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
  ref: string | null;
  isImported: boolean;
  customerName: string | null;
  customer: Customer | null;
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

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPdfLoading, setBulkPdfLoading] = useState(false);
  // Per-row PDF loading
  const [rowPdfLoading, setRowPdfLoading] = useState<string | null>(null);
  // Clipboard-style copy/paste
  const [copiedInvoiceId, setCopiedInvoiceId] = useState<string | null>(null);
  const [isPasting, setIsPasting] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

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
      if (statusFilter !== "ALL") url += `&status=${statusFilter}`;
      if (brandFilter) url += `&brandId=${brandFilter}`;
      if (customerFilter) url += `&customerId=${customerFilter}`;
      if (dateFrom) url += `&dateFrom=${dateFrom}`;
      if (dateTo) url += `&dateTo=${dateTo}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch invoices");

      const data = await response.json();
      setInvoices(data.invoices || []);
      setTotalCount(data.pagination?.total || 0);
      if (data.stats) setServerStats(data.stats);
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

  // Clear selections when data changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [invoices]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchInvoices();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setCurrentPage(1);
    fetchInvoices();
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleDelete = async (invoiceId: string) => {
    if (!confirm("Are you sure you want to delete this invoice? This will restore stock and cannot be undone.")) return;
    try {
      const response = await fetch(`/api/sales-invoices/${invoiceId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete invoice");
      }
      fetchInvoices();
    } catch (err) {
      console.error("Error deleting invoice:", err);
      alert(err instanceof Error ? err.message : "Failed to delete invoice");
    }
  };

  // ── Per-row PDF download ─────────────────────────────────────
  const handleRowPDF = async (invoiceId: string) => {
    setRowPdfLoading(invoiceId);
    try {
      const [invoiceRes, deps] = await Promise.all([
        fetch(`/api/sales-invoices/${invoiceId}`),
        fetchCompanySettings(),
      ]);
      if (!invoiceRes.ok) throw new Error("Failed to fetch invoice");
      const fullInvoice = await invoiceRes.json();
      generateInvoicePDF(fullInvoice, deps.company, deps.bank);
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("Failed to generate PDF.");
    } finally {
      setRowPdfLoading(null);
    }
  };

  // ── Bulk PDF download ────────────────────────────────────────
  const handleBulkPDF = async () => {
    if (selectedIds.size === 0) return;
    setBulkPdfLoading(true);
    try {
      const deps = await fetchCompanySettings();
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        const res = await fetch(`/api/sales-invoices/${id}`);
        if (!res.ok) continue;
        const fullInvoice = await res.json();
        generateInvoicePDF(fullInvoice, deps.company, deps.bank);
        // Small delay between downloads so browser doesn't block them
        if (ids.length > 1) await new Promise((r) => setTimeout(r, 500));
      }
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Error in bulk PDF:", err);
      alert("Some PDFs failed to generate.");
    } finally {
      setBulkPdfLoading(false);
    }
  };

  // ── Clipboard copy / paste ────────────────────────────────────
  const handleCopyInvoice = (invoiceId: string) => {
    setCopiedInvoiceId(invoiceId);
    setContextMenu(null);
  };

  const handlePasteInvoice = async () => {
    if (!copiedInvoiceId) return;
    setContextMenu(null);
    setIsPasting(true);
    try {
      const response = await fetch("/api/sales-invoices/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceInvoiceId: copiedInvoiceId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to paste invoice");
      setCopiedInvoiceId(null);
      router.push(`/sales/invoices/${data.id}`);
    } catch (err) {
      console.error("Error pasting invoice:", err);
      alert(err instanceof Error ? err.message : "Failed to create copy");
    } finally {
      setIsPasting(false);
    }
  };

  // Right-click context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!copiedInvoiceId) return;
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

  // ── Selection helpers ────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === invoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invoices.map((i) => i.id)));
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

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const stats = useMemo(() => {
    if (serverStats) return serverStats;
    const pending = invoices.filter((i) => i.effectiveStatus === "PENDING").length;
    const overdue = invoices.filter((i) => i.effectiveStatus === "OVERDUE").length;
    const paid = invoices.filter((i) => i.effectiveStatus === "PAID").length;
    const totalReceivable = invoices
      .filter((i) => i.effectiveStatus !== "PAID" && i.effectiveStatus !== "CANCELLED")
      .reduce((sum, i) => sum + Number(i.balanceAmount), 0);
    return { total: totalCount, pending, overdue, paid, totalReceivable };
  }, [invoices, totalCount, serverStats]);

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Sales Invoices</h1>
          <p className="text-gray-600">Manage customer invoices and track payments</p>
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
        <div className="space-y-4 mb-6">
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
              <ExportButtons
                onExportExcel={async () => {
                  const { company } = await fetchCompanySettings();
                  const headers = ["Invoice Date", "Invoice #", "Order #", "Customer", "Due Date", "Status", "Subtotal", "Tax", "Total", "Paid", "Balance"];
                  const rows = invoices.map((i) => [
                    fmtDateExport(i.invoiceDate),
                    i.invoiceNumber,
                    i.orderNumber || "-",
                    i.customer?.name || i.customerName || '-',
                    i.dueDate ? fmtDateExport(i.dueDate) : "-",
                    i.effectiveStatus,
                    Number(i.subtotal),
                    Number(i.taxAmount),
                    Number(i.totalAmount),
                    Number(i.paidAmount),
                    Number(i.balanceAmount),
                  ]);
                  exportToExcel({ fileName: "Sales-Invoices.xlsx", sheets: [{ name: "Sales Invoices", headers, rows }], company });
                }}
                onExportPDF={async () => {
                  const { company } = await fetchCompanySettings();
                  const headers = ["Date", "Invoice #", "Customer", "Status", "Total", "Balance"];
                  const rows = invoices.map((i) => [
                    fmtDateExport(i.invoiceDate),
                    i.invoiceNumber,
                    i.customer?.name || i.customerName || '-',
                    i.effectiveStatus,
                    fmtNum(Number(i.totalAmount)),
                    fmtNum(Number(i.balanceAmount)),
                  ]);
                  exportToPDF({ fileName: "Sales-Invoices.pdf", title: "Sales Invoices", subtitle: `Generated on ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`, orientation: "landscape", sheets: [{ name: "Sales Invoices", headers, rows }], company });
                }}
                disabled={isLoading || invoices.length === 0}
              />
              <ImportButton entityType="SALES_INVOICE" entityLabel="Sales Invoices" onSuccess={() => fetchInvoices()} />
              <Button
                size="sm"
                className="bg-teal-500 hover:bg-teal-600 text-white"
                onClick={() => window.location.href = "/sales/invoices/new"}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                New Invoice
              </Button>
            </div>
          </div>

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

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="mb-4 flex items-center gap-4 px-4 py-3 bg-teal-50 border border-teal-200 rounded-lg">
            <span className="text-sm font-medium text-teal-800">
              {selectedIds.size} selected
            </span>
            <Button
              size="sm"
              onClick={handleBulkPDF}
              disabled={bulkPdfLoading}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {bulkPdfLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              Download PDFs
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="text-teal-700"
            >
              Clear selection
            </Button>
          </div>
        )}

        {/* Clipboard copy banner */}
        {copiedInvoiceId && (
          <div className="mb-3 flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-800">
            <Copy className="h-4 w-4 shrink-0" />
            <span>Invoice copied — right-click anywhere in the table to paste.</span>
            {isPasting && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
            <button onClick={() => setCopiedInvoiceId(null)} className="ml-auto text-indigo-400 hover:text-indigo-600">
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
              onClick={handlePasteInvoice}
              disabled={isPasting}
              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 disabled:opacity-50"
            >
              {isPasting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              Paste Invoice
            </button>
          </div>
        )}

        {/* Invoices Table */}
        <div ref={tableRef} onContextMenu={handleContextMenu} className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table aria-label="Sales invoices list">
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead scope="col" className="w-10">
                    <input
                      type="checkbox"
                      checked={invoices.length > 0 && selectedIds.size === invoices.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                  </TableHead>
                  <TableHead scope="col" className="font-semibold">Invoice Date</TableHead>
                  <TableHead scope="col" className="font-semibold">Invoice #</TableHead>
                  <TableHead scope="col" className="font-semibold">Order #</TableHead>
                  <TableHead scope="col" className="font-semibold">Customer</TableHead>
                  <TableHead scope="col" className="font-semibold">Due Date</TableHead>
                  <TableHead scope="col" className="font-semibold text-center">Status</TableHead>
                  <TableHead scope="col" className="font-semibold text-right">Total</TableHead>
                  <TableHead scope="col" className="font-semibold text-right">Balance</TableHead>
                  <TableHead scope="col" className="font-semibold w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-gray-500 py-12">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Loading invoices...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-red-600 py-8">
                      <div className="space-y-2">
                        <p>Error: {error}</p>
                        <Button onClick={fetchInvoices} variant="outline" size="sm">Try Again</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-gray-500 py-8">
                      {searchQuery || statusFilter !== "ALL"
                        ? "No invoices found matching your filters"
                        : "No invoices yet. Create invoices from delivered sales orders."}
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((invoice) => (
                    <TableRow key={invoice.id} className={invoice.isImported ? "bg-yellow-50 hover:bg-yellow-100" : "hover:bg-gray-50"}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(invoice.id)}
                          onChange={() => toggleSelect(invoice.id)}
                          className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(invoice.invoiceDate)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => router.push(`/sales/invoices/${invoice.id}`)}
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
                      <TableCell className="text-sm text-gray-600">{invoice.orderNumber || "-"}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{invoice.customer?.name || invoice.customerName || '-'}</p>
                          <p className="text-xs text-gray-500">{invoice.customer?.customerNumber || ''}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(invoice.dueDate)}</TableCell>
                      <TableCell className="text-center">
                        <InvoiceStatusBadge status={invoice.effectiveStatus} />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(invoice.totalAmount))}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={Number(invoice.balanceAmount) > 0 ? "text-red-600 font-medium" : "text-green-600"}>
                          {formatCurrency(Number(invoice.balanceAmount))}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => router.push(`/sales/invoices/${invoice.id}`)}>
                              <Eye className="h-4 w-4 mr-2 text-teal-600" />
                              View Details
                            </DropdownMenuItem>
                            {(invoice.effectiveStatus === "PENDING" || invoice.effectiveStatus === "OVERDUE" || invoice.effectiveStatus === "PARTIAL") && (
                              <DropdownMenuItem onClick={() => router.push(`/sales/invoices/new?edit=${invoice.id}`)}>
                                <Edit className="h-4 w-4 mr-2 text-blue-600" />
                                Edit Invoice
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleRowPDF(invoice.id)}
                              disabled={rowPdfLoading === invoice.id}
                            >
                              {rowPdfLoading === invoice.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <FileDown className="h-4 w-4 mr-2 text-gray-600" />
                              )}
                              Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopyInvoice(invoice.id)}>
                              <Copy className="h-4 w-4 mr-2 text-indigo-600" />
                              Copy Invoice
                            </DropdownMenuItem>
                            {invoice.effectiveStatus !== "PAID" && invoice.effectiveStatus !== "CANCELLED" && (
                              <DropdownMenuItem
                                onClick={() => invoice.customer && router.push(`/sales/receipts/new?customerId=${invoice.customer.id}`)}
                              >
                                <CreditCard className="h-4 w-4 mr-2 text-green-600" />
                                Record Payment
                              </DropdownMenuItem>
                            )}
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(invoice.id)}
                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Invoice
                              </DropdownMenuItem>
                            </>
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
          <div className="mt-6 flex items-center justify-between">
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
