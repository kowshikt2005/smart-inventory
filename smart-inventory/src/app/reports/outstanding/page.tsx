"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useState, useMemo } from "react";
import useSWR from "swr";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ChevronDown, X, Calendar, Eye } from "lucide-react";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { exportToExcel, exportToPDF, generatePDFBase64, fmtNum, fmtDateExport, fetchCompanySettings } from "@/lib/export-utils";
import { EmailReportDialog } from "@/components/reports/EmailReportDialog";

interface OutstandingInvoice {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  balanceAmount: number;
  paidAmount: number;
  daysOverdue: number;
  status: string;
  partyId: string;
  partyName: string;
  creditDays: number;
  // Customer-specific
  customerId?: string;
  customerName?: string;
  // Vendor-specific
  vendorId?: string;
  vendorName?: string;
}

interface InvoiceItem {
  id: string;
  quantity: number;
  rate: number;
  taxRate: number;
  taxAmount: number;
  amount: number;
  item: {
    id: string;
    itemCode: string;
    name: string;
    unit: string;
    hsnCode: string | null;
  };
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  subtotal: number;
  cgst: number;
  sgst: number;
  taxAmount: number;
  roundOff: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: string;
  effectiveStatus: string;
  notes: string | null;
  customer: {
    id: string;
    customerNumber: string;
    name: string;
    gstin: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    creditDays: number;
  };
  items: InvoiceItem[];
  allocations: Array<{
    id: string;
    amount: number;
    payment: {
      paymentNumber: string;
      paymentDate: string;
      amount: number;
      mode: string;
    };
  }>;
}

interface PurchaseInvoiceDetail {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  notes: string | null;
  vendor: {
    id: string;
    vendorNumber: string;
    name: string;
    gstin: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
  };
  items: {
    id: string;
    quantity: number;
    rate: number;
    taxRate: number;
    taxAmount: number;
    amount: number;
    item: {
      id: string;
      itemCode: string;
      name: string;
      unit: string;
      hsnCode: string | null;
    };
  }[];
  vendorPayments: {
    id: string;
    paymentNumber: string;
    date: string;
    amount: number;
    mode: string;
  }[];
}

interface Summary {
  totalParties: number;
  totalInvoices: number;
  totalOutstanding: number;
}

type TabType = "customer" | "vendor";

export default function OutstandingReportPage() {
  const [tab, setTab] = useState<TabType>("customer");
  const [customerId, setCustomerId] = useState("all");
  const [vendorId, setVendorId] = useState("all");
  const [showPartyDrop, setShowPartyDrop] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);
  const [selectedPurchaseInvoice, setSelectedPurchaseInvoice] = useState<PurchaseInvoiceDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Party lists for filters
  const { data: customersData } = useSWR("/api/customers?limit=500");
  const { data: vendorsData } = useSWR("/api/vendors?limit=500");
  const customers: { id: string; name: string }[] = customersData?.customers || [];
  const vendors: { id: string; name: string }[] = vendorsData?.vendors || [];

  const parties = tab === "customer" ? customers : vendors;
  const selectedPartyId = tab === "customer" ? customerId : vendorId;

  const selectedPartyName =
    selectedPartyId === "all"
      ? tab === "customer" ? "All Customers" : "All Vendors"
      : parties.find((p) => p.id === selectedPartyId)?.name || (tab === "customer" ? "All Customers" : "All Vendors");

  // API query
  const queryString = useMemo(() => {
    const params: string[] = [`type=${tab}`];
    if (tab === "customer" && customerId !== "all") params.push(`customerId=${customerId}`);
    if (tab === "vendor" && vendorId !== "all") params.push(`vendorId=${vendorId}`);
    if (fromDate) params.push(`fromDate=${fromDate}`);
    if (toDate) params.push(`toDate=${toDate}`);
    return params.join("&");
  }, [tab, customerId, vendorId, fromDate, toDate]);

  const { data, isLoading } = useSWR(
    `/api/reports/outstanding?${queryString}`,
    { revalidateIfStale: false }
  );

  const invoices: OutstandingInvoice[] = data?.invoices || [];
  const summary: Summary = data?.summary || {
    totalParties: 0,
    totalInvoices: 0,
    totalOutstanding: 0,
  };

  // Helpers
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const fmtDate = (s: string) => {
    if (!s) return "\u2014";
    const [y, m, d] = s.split("-");
    return `${d}-${m}-${y}`;
  };

  const formatDateLong = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getOverdueBadgeClass = (days: number) => {
    if (days <= 0) return "bg-green-100 text-green-700";
    if (days <= 30) return "bg-amber-100 text-amber-700";
    if (days <= 60) return "bg-orange-100 text-orange-700";
    return "bg-red-100 text-red-700";
  };

  const getStatusBadge = (status: string, daysOverdue: number) => {
    if (status === "CANCELLED") return { label: "Cancelled", class: "bg-gray-100 text-gray-700" };
    if (status === "PARTIAL") return { label: "Partial", class: "bg-blue-100 text-blue-700" };
    if (daysOverdue > 0) return { label: `${daysOverdue} days overdue`, class: getOverdueBadgeClass(daysOverdue) };
    return { label: "Pending", class: "bg-yellow-100 text-yellow-700" };
  };

  const clearDateFilters = () => {
    setFromDate("");
    setToDate("");
  };

  // Fetch invoice detail (customer)
  const handleCustomerInvoiceClick = async (invoiceId: string) => {
    setIsLoadingDetail(true);
    setSelectedPurchaseInvoice(null);
    try {
      const response = await fetch(`/api/sales-invoices/${invoiceId}`);
      if (!response.ok) throw new Error("Failed to fetch invoice details");
      const data = await response.json();
      setSelectedInvoice(data);
    } catch (err) {
      console.error("Error fetching invoice:", err);
      alert("Failed to load invoice details");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Fetch invoice detail (vendor)
  const handleVendorInvoiceClick = async (invoiceId: string) => {
    setIsLoadingDetail(true);
    setSelectedInvoice(null);
    try {
      const response = await fetch(`/api/purchase-invoices/${invoiceId}`);
      if (!response.ok) throw new Error("Failed to fetch invoice details");
      const data = await response.json();
      setSelectedPurchaseInvoice(data);
    } catch (err) {
      console.error("Error fetching invoice:", err);
      alert("Failed to load invoice details");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleInvoiceClick = (invoiceId: string) => {
    if (tab === "customer") {
      handleCustomerInvoiceClick(invoiceId);
    } else {
      handleVendorInvoiceClick(invoiceId);
    }
  };

  const closeModal = () => {
    setSelectedInvoice(null);
    setSelectedPurchaseInvoice(null);
  };

  const handleTabChange = (newTab: TabType) => {
    setTab(newTab);
    setShowPartyDrop(false);
  };

  const handlePartySelect = (id: string) => {
    if (tab === "customer") {
      setCustomerId(id);
    } else {
      setVendorId(id);
    }
    setShowPartyDrop(false);
  };

  const handleExportExcel = async () => {
    const { company } = await fetchCompanySettings();
    const partyLabel = tab === "customer" ? "Customer" : "Vendor";
    const headers = [partyLabel, "Invoice No", "Invoice Date", "Due Date", "Amount", "Paid", "Outstanding", "Days Overdue", "Status"];
    const rows = invoices.map((inv) => [inv.partyName, inv.invoiceNumber, fmtDateExport(inv.invoiceDate), fmtDateExport(inv.dueDate), inv.totalAmount, inv.paidAmount, inv.balanceAmount, inv.daysOverdue, inv.status]);
    const dateInfo = fromDate && toDate ? `_${fmtDateExport(fromDate)}_to_${fmtDateExport(toDate)}` : "";
    exportToExcel({ fileName: `Outstanding-Report_${tab}${dateInfo}.xlsx`, sheets: [{ name: "Outstanding", headers, rows }], company });
  };

  const handleExportPDF = async () => {
    const { company } = await fetchCompanySettings();
    const partyLabel = tab === "customer" ? "Customer" : "Vendor";
    const headers = [partyLabel, "Invoice No", "Inv Date", "Due Date", "Amount", "Paid", "Outstanding", "Days Overdue", "Status"];
    const rows = invoices.map((inv) => [inv.partyName, inv.invoiceNumber, fmtDateExport(inv.invoiceDate), fmtDateExport(inv.dueDate), fmtNum(inv.totalAmount), fmtNum(inv.paidAmount), fmtNum(inv.balanceAmount), inv.daysOverdue > 0 ? `${inv.daysOverdue} days` : "-", inv.daysOverdue > 0 ? "Overdue" : inv.status === "PARTIAL" ? "Partial" : "Pending"]);
    const dateRange = fromDate && toDate ? ` | ${fmtDateExport(fromDate)} to ${fmtDateExport(toDate)}` : fromDate ? ` | From ${fmtDateExport(fromDate)}` : toDate ? ` | Up to ${fmtDateExport(toDate)}` : "";
    const dateFile = fromDate && toDate ? `_${fmtDateExport(fromDate)}_to_${fmtDateExport(toDate)}` : "";
    exportToPDF({ fileName: `Outstanding-Report_${tab}${dateFile}.pdf`, title: "Outstanding Report", subtitle: `${partyLabel}s | ${selectedPartyName}${dateRange}`, sheets: [{ name: "Outstanding", headers, rows }], company });
  };

  // ── Email send handler ─────────────────────────────────────
  const handleEmailSend = async (emails: string[], emailFromDate: string, emailToDate: string) => {
    const { company } = await fetchCompanySettings();
    const partyLabel = tab === "customer" ? "Customer" : "Vendor";

    const params: string[] = [`type=${tab}`];
    if (customerId !== "all") params.push(`customerId=${customerId}`);
    if (vendorId !== "all") params.push(`vendorId=${vendorId}`);
    if (emailFromDate) params.push(`fromDate=${emailFromDate}`);
    if (emailToDate) params.push(`toDate=${emailToDate}`);

    const res = await fetch(`/api/reports/outstanding?${params.join("&")}`);
    if (!res.ok) throw new Error("Failed to fetch report data");
    const fetchedData = await res.json();
    const fetchedInvoices: OutstandingInvoice[] = fetchedData.invoices || [];

    const headers = [partyLabel, "Invoice No", "Inv Date", "Due Date", "Amount", "Paid", "Outstanding", "Days Overdue", "Status"];
    const rows = fetchedInvoices.map((inv) => [inv.partyName, inv.invoiceNumber, fmtDateExport(inv.invoiceDate), fmtDateExport(inv.dueDate), fmtNum(inv.totalAmount), fmtNum(inv.paidAmount), fmtNum(inv.balanceAmount), inv.daysOverdue > 0 ? `${inv.daysOverdue} days` : "-", inv.daysOverdue > 0 ? "Overdue" : inv.status === "PARTIAL" ? "Partial" : "Pending"]);

    const dateRangeLabel = emailFromDate && emailToDate
      ? `${fmtDateExport(emailFromDate)} to ${fmtDateExport(emailToDate)}`
      : `As of ${new Date().toLocaleDateString("en-IN")}`;
    const dateFile = emailFromDate && emailToDate ? `_${fmtDateExport(emailFromDate)}_to_${fmtDateExport(emailToDate)}` : "";
    const subtitle = `${partyLabel}s | ${selectedPartyName}${emailFromDate && emailToDate ? ` | ${dateRangeLabel}` : ""}`;

    const pdfBase64 = generatePDFBase64({
      title: "Outstanding Report",
      subtitle,
      sheets: [{ name: "Outstanding", headers, rows }],
      company,
    });

    const send = await fetch("/api/reports/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emails,
        subject: `Outstanding Report (${partyLabel}s) — ${dateRangeLabel}`,
        pdfBase64,
        filename: `Outstanding-Report_${tab}${dateFile}.pdf`,
        reportTitle: "Outstanding Report",
        dateRange: dateRangeLabel,
      }),
    });
    if (!send.ok) {
      const d = await send.json();
      throw new Error(d.error || "Failed to send email");
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="text-center mb-4 relative">
          <h1 className="text-2xl font-bold text-gray-900">Outstanding Report</h1>
          <p className="text-sm text-gray-500">
            All unpaid invoices (excluding fully paid)
          </p>
          <div className="absolute right-0 top-0 flex items-center gap-2">
            <ExportButtons onExportPDF={handleExportPDF} onExportExcel={handleExportExcel} disabled={isLoading || invoices.length === 0} />
            <EmailReportDialog
              reportTitle="Outstanding Report"
              defaultStartDate={fromDate}
              defaultEndDate={toDate}
              hasDateFilter
              onSendEmail={handleEmailSend}
              disabled={isLoading || invoices.length === 0}
            />
          </div>
        </div>

        {/* Customer / Vendor Toggle */}
        <div className="flex justify-center mb-6">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => handleTabChange("customer")}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === "customer"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Customers
            </button>
            <button
              onClick={() => handleTabChange("vendor")}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === "vendor"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Vendors
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">{tab === "customer" ? "Customers" : "Vendors"}</p>
            <p className="text-2xl font-bold text-blue-600">{summary.totalParties}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Invoices</p>
            <p className="text-2xl font-bold text-orange-600">{summary.totalInvoices}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Total Outstanding</p>
            <p className="text-2xl font-bold text-red-600">{"\u20B9"}{fmt(summary.totalOutstanding)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
          {/* Party dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPartyDrop(!showPartyDrop)}
              className="flex items-center gap-2 bg-amber-700 hover:bg-amber-800 text-white px-5 py-2 rounded-md text-sm font-medium shadow-sm"
            >
              <span>{tab === "customer" ? "\uD83C\uDFE0" : "\uD83C\uDFED"}</span>
              <span>{selectedPartyName}</span>
              <ChevronDown className="h-4 w-4" />
            </button>

            {showPartyDrop && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white border rounded-lg shadow-lg z-10 w-64 max-h-56 overflow-y-auto">
                <button
                  onClick={() => handlePartySelect("all")}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                    selectedPartyId === "all"
                      ? "bg-teal-50 font-semibold text-teal-700"
                      : "text-gray-700"
                  }`}
                >
                  {tab === "customer" ? "All Customers" : "All Vendors"}
                </button>
                {parties.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePartySelect(p.id)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                      selectedPartyId === p.id
                        ? "bg-teal-50 font-semibold text-teal-700"
                        : "text-gray-700"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date filters */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-40"
              placeholder="From Date"
            />
            <span className="text-gray-400">to</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-40"
              placeholder="To Date"
            />
            {(fromDate || toDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearDateFilters}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-4 mb-4">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-green-100 border border-green-300" />
            <span className="text-xs text-gray-500">Not due</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-amber-100 border border-amber-300" />
            <span className="text-xs text-gray-500">1-30 days</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-orange-100 border border-orange-300" />
            <span className="text-xs text-gray-500">31-60 days</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-red-100 border border-red-300" />
            <span className="text-xs text-gray-500">60+ days</span>
          </div>
        </div>

        {/* Main table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading outstanding report...</span>
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <p className="text-lg font-medium">No outstanding invoices</p>
              <p className="text-sm mt-1">All invoices have been paid</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-100">
                    <TableHead className="font-semibold text-gray-700">
                      {tab === "customer" ? "Customer" : "Vendor"}
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700">Invoice No</TableHead>
                    <TableHead className="font-semibold text-gray-700">Invoice Date</TableHead>
                    <TableHead className="font-semibold text-gray-700">Due Date</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Amount</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Paid</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Outstanding</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-center">Status</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {invoices.map((inv) => {
                    const statusInfo = getStatusBadge(inv.status, inv.daysOverdue);
                    return (
                      <TableRow
                        key={inv.invoiceId}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleInvoiceClick(inv.invoiceId)}
                      >
                        <TableCell className="font-medium text-gray-800">
                          {inv.partyName}
                        </TableCell>
                        <TableCell className="text-teal-600 font-medium">
                          {inv.invoiceNumber}
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {fmtDate(inv.invoiceDate)}
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {fmtDate(inv.dueDate)}
                        </TableCell>
                        <TableCell className="text-right text-gray-700">
                          {fmt(inv.totalAmount)}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {fmt(inv.paidAmount)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          {fmt(inv.balanceAmount)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusInfo.class}`}
                          >
                            {statusInfo.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInvoiceClick(inv.invoiceId);
                            }}
                          >
                            <Eye className="h-4 w-4 text-gray-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Total row */}
              <div className="border-t-2 border-gray-300 bg-gray-50">
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-bold text-gray-900">Total</TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell />
                      <TableCell className="text-right font-bold text-gray-900">
                        {fmt(invoices.reduce((sum, inv) => sum + inv.totalAmount, 0))}
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {fmt(invoices.reduce((sum, inv) => sum + inv.paidAmount, 0))}
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        {fmt(invoices.reduce((sum, inv) => sum + inv.balanceAmount, 0))}
                      </TableCell>
                      <TableCell />
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Customer Invoice Detail Modal */}
      {(selectedInvoice || isLoadingDetail) && !selectedPurchaseInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {isLoadingDetail ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
              </div>
            ) : selectedInvoice ? (
              <>
                <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Invoice {selectedInvoice.invoiceNumber}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedInvoice.customer.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        selectedInvoice.effectiveStatus === "PAID"
                          ? "bg-green-100 text-green-700"
                          : selectedInvoice.effectiveStatus === "OVERDUE"
                          ? "bg-red-100 text-red-700"
                          : selectedInvoice.effectiveStatus === "PARTIAL"
                          ? "bg-blue-100 text-blue-700"
                          : selectedInvoice.effectiveStatus === "CANCELLED"
                          ? "bg-gray-100 text-gray-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {selectedInvoice.effectiveStatus}
                    </span>
                    <Button variant="ghost" size="sm" onClick={closeModal}>
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-700 mb-3">Customer Details</h3>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-gray-500">Name:</span> {selectedInvoice.customer.name}</p>
                        <p><span className="text-gray-500">Customer #:</span> {selectedInvoice.customer.customerNumber}</p>
                        {selectedInvoice.customer.gstin && (
                          <p><span className="text-gray-500">GSTIN:</span> {selectedInvoice.customer.gstin}</p>
                        )}
                        {selectedInvoice.customer.phone && (
                          <p><span className="text-gray-500">Phone:</span> {selectedInvoice.customer.phone}</p>
                        )}
                        {selectedInvoice.customer.address && (
                          <p>
                            <span className="text-gray-500">Address:</span> {selectedInvoice.customer.address}
                            {selectedInvoice.customer.city && `, ${selectedInvoice.customer.city}`}
                            {selectedInvoice.customer.state && `, ${selectedInvoice.customer.state}`}
                            {selectedInvoice.customer.pincode && ` - ${selectedInvoice.customer.pincode}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-700 mb-3">Invoice Details</h3>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-gray-500">Invoice Date:</span> {formatDateLong(selectedInvoice.invoiceDate)}</p>
                        <p><span className="text-gray-500">Due Date:</span> {formatDateLong(selectedInvoice.dueDate)}</p>
                        <p><span className="text-gray-500">Credit Days:</span> {selectedInvoice.customer.creditDays} days</p>
                        {selectedInvoice.notes && (
                          <p><span className="text-gray-500">Notes:</span> {selectedInvoice.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="font-semibold text-gray-700 mb-3">Items</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-100">
                            <TableHead className="font-semibold">Item</TableHead>
                            <TableHead className="font-semibold">HSN</TableHead>
                            <TableHead className="font-semibold text-right">Qty</TableHead>
                            <TableHead className="font-semibold text-right">Rate</TableHead>
                            <TableHead className="font-semibold text-right">GST %</TableHead>
                            <TableHead className="font-semibold text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedInvoice.items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{item.item.name}</p>
                                  <p className="text-xs text-gray-500">{item.item.itemCode}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{item.item.hsnCode || "-"}</TableCell>
                              <TableCell className="text-right">
                                {Number(item.quantity)} {item.item.unit}
                              </TableCell>
                              <TableCell className="text-right">{fmt(Number(item.rate))}</TableCell>
                              <TableCell className="text-right">{Number(item.taxRate)}%</TableCell>
                              <TableCell className="text-right font-medium">
                                {fmt(Number(item.quantity) * Number(item.rate))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {selectedInvoice.allocations.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-700 mb-3">Payments Received</h3>
                        <div className="border rounded-lg p-4 space-y-2">
                          {selectedInvoice.allocations.map((alloc) => (
                            <div key={alloc.id} className="flex justify-between text-sm border-b pb-2 last:border-0">
                              <div>
                                <p className="font-medium">{alloc.payment.paymentNumber}</p>
                                <p className="text-xs text-gray-500">
                                  {formatDateLong(alloc.payment.paymentDate)} - {alloc.payment.mode}
                                </p>
                              </div>
                              <p className="font-medium text-green-600">{"\u20B9"}{fmt(Number(alloc.amount))}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className={selectedInvoice.allocations.length === 0 ? "col-span-2" : ""}>
                      <h3 className="font-semibold text-gray-700 mb-3">Summary</h3>
                      <div className="border rounded-lg p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Subtotal</span>
                          <span>{"\u20B9"}{fmt(Number(selectedInvoice.subtotal))}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">CGST</span>
                          <span>{"\u20B9"}{fmt(Number(selectedInvoice.cgst))}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">SGST</span>
                          <span>{"\u20B9"}{fmt(Number(selectedInvoice.sgst))}</span>
                        </div>
                        {Number(selectedInvoice.roundOff) !== 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Round Off</span>
                            <span>{"\u20B9"}{fmt(Number(selectedInvoice.roundOff))}</span>
                          </div>
                        )}
                        <hr />
                        <div className="flex justify-between font-bold text-lg">
                          <span>Total Amount</span>
                          <span>{"\u20B9"}{fmt(Number(selectedInvoice.totalAmount))}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Paid</span>
                          <span className="text-green-600 font-medium">{"\u20B9"}{fmt(Number(selectedInvoice.paidAmount))}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg text-red-600">
                          <span>Balance</span>
                          <span>{"\u20B9"}{fmt(Number(selectedInvoice.balanceAmount))}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
                  <Button variant="outline" onClick={closeModal}>
                    Close
                  </Button>
                  <Button
                    className="bg-teal-600 hover:bg-teal-700"
                    onClick={() => {
                      window.location.href = `/sales/invoices/${selectedInvoice.id}`;
                    }}
                  >
                    View Full Details
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Vendor Invoice Detail Modal */}
      {(selectedPurchaseInvoice || (isLoadingDetail && !selectedInvoice)) && !selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {isLoadingDetail ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
              </div>
            ) : selectedPurchaseInvoice ? (
              <>
                <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Purchase Invoice {selectedPurchaseInvoice.invoiceNumber}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedPurchaseInvoice.vendor.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        selectedPurchaseInvoice.status === "PAID"
                          ? "bg-green-100 text-green-700"
                          : selectedPurchaseInvoice.status === "OVERDUE"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {selectedPurchaseInvoice.status}
                    </span>
                    <Button variant="ghost" size="sm" onClick={closeModal}>
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-700 mb-3">Vendor Details</h3>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-gray-500">Name:</span> {selectedPurchaseInvoice.vendor.name}</p>
                        <p><span className="text-gray-500">Vendor #:</span> {selectedPurchaseInvoice.vendor.vendorNumber}</p>
                        {selectedPurchaseInvoice.vendor.gstin && (
                          <p><span className="text-gray-500">GSTIN:</span> {selectedPurchaseInvoice.vendor.gstin}</p>
                        )}
                        {selectedPurchaseInvoice.vendor.phone && (
                          <p><span className="text-gray-500">Phone:</span> {selectedPurchaseInvoice.vendor.phone}</p>
                        )}
                        {selectedPurchaseInvoice.vendor.address && (
                          <p>
                            <span className="text-gray-500">Address:</span> {selectedPurchaseInvoice.vendor.address}
                            {selectedPurchaseInvoice.vendor.city && `, ${selectedPurchaseInvoice.vendor.city}`}
                            {selectedPurchaseInvoice.vendor.state && `, ${selectedPurchaseInvoice.vendor.state}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-700 mb-3">Invoice Details</h3>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-gray-500">Invoice Date:</span> {formatDateLong(selectedPurchaseInvoice.date)}</p>
                        <p><span className="text-gray-500">Due Date:</span> {formatDateLong(selectedPurchaseInvoice.dueDate)}</p>
                        {selectedPurchaseInvoice.notes && (
                          <p><span className="text-gray-500">Notes:</span> {selectedPurchaseInvoice.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="font-semibold text-gray-700 mb-3">Items</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-100">
                            <TableHead className="font-semibold">Item</TableHead>
                            <TableHead className="font-semibold">HSN</TableHead>
                            <TableHead className="font-semibold text-right">Qty</TableHead>
                            <TableHead className="font-semibold text-right">Rate</TableHead>
                            <TableHead className="font-semibold text-right">Tax %</TableHead>
                            <TableHead className="font-semibold text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedPurchaseInvoice.items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{item.item.name}</p>
                                  <p className="text-xs text-gray-500">{item.item.itemCode}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{item.item.hsnCode || "-"}</TableCell>
                              <TableCell className="text-right">
                                {Number(item.quantity)} {item.item.unit}
                              </TableCell>
                              <TableCell className="text-right">{fmt(Number(item.rate))}</TableCell>
                              <TableCell className="text-right">{Number(item.taxRate)}%</TableCell>
                              <TableCell className="text-right font-medium">
                                {fmt(Number(item.amount) + Number(item.taxAmount))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {selectedPurchaseInvoice.vendorPayments.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-700 mb-3">Payments Made</h3>
                        <div className="border rounded-lg p-4 space-y-2">
                          {selectedPurchaseInvoice.vendorPayments.map((payment) => (
                            <div key={payment.id} className="flex justify-between text-sm border-b pb-2 last:border-0">
                              <div>
                                <p className="font-medium">{payment.paymentNumber}</p>
                                <p className="text-xs text-gray-500">
                                  {formatDateLong(payment.date)} - {payment.mode}
                                </p>
                              </div>
                              <p className="font-medium text-green-600">{"\u20B9"}{fmt(Number(payment.amount))}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className={selectedPurchaseInvoice.vendorPayments.length === 0 ? "col-span-2" : ""}>
                      <h3 className="font-semibold text-gray-700 mb-3">Summary</h3>
                      <div className="border rounded-lg p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Subtotal</span>
                          <span>{"\u20B9"}{fmt(Number(selectedPurchaseInvoice.amount))}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Tax</span>
                          <span>{"\u20B9"}{fmt(Number(selectedPurchaseInvoice.taxAmount))}</span>
                        </div>
                        <hr />
                        <div className="flex justify-between font-bold text-lg">
                          <span>Total Amount</span>
                          <span>{"\u20B9"}{fmt(Number(selectedPurchaseInvoice.totalAmount))}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Paid</span>
                          <span className="text-green-600 font-medium">{"\u20B9"}{fmt(Number(selectedPurchaseInvoice.paidAmount))}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg text-red-600">
                          <span>Balance</span>
                          <span>{"\u20B9"}{fmt(Number(selectedPurchaseInvoice.balanceAmount))}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
                  <Button variant="outline" onClick={closeModal}>
                    Close
                  </Button>
                  <Button
                    className="bg-teal-600 hover:bg-teal-700"
                    onClick={() => {
                      window.location.href = `/purchases/invoices/${selectedPurchaseInvoice.id}`;
                    }}
                  >
                    View Full Details
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
