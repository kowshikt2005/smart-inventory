"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, MoreVertical, Trash2, Loader2, X, Eye, Wallet, Filter } from "lucide-react";
import { ImportButton } from "@/components/import/ImportButton";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { exportToExcel, exportToPDF, fmtDateExport, fmtNum, fetchCompanySettings } from "@/lib/export-utils";
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
  vendor: { id: string; vendorNumber: string; name: string };
  purchaseInvoice: { id: string; invoiceNumber: string; totalAmount: number; balanceAmount: number } | null;
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
  const [selectedPayment, setSelectedPayment] = useState<VendorPayment | null>(null);
  const itemsPerPage = 15;

  const { data: vendorsData } = useSWR("/api/vendors?limit=500");
  const vendors = vendorsData?.vendors || [];

  const activeFilterCount = [vendorFilter, dateFrom, dateTo].filter(Boolean).length;
  const debouncedSearch = useDebounce(searchQuery, 300);

  const apiUrl = useMemo(() => {
    let url = `/api/vendor-payments?page=${currentPage}&limit=${itemsPerPage}`;
    if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;
    if (paymentFilter !== "all") url += `&type=${paymentFilter}`;
    if (vendorFilter) url += `&vendorId=${vendorFilter}`;
    if (dateFrom) url += `&dateFrom=${dateFrom}`;
    if (dateTo) url += `&dateTo=${dateTo}`;
    return url;
  }, [currentPage, debouncedSearch, paymentFilter, vendorFilter, dateFrom, dateTo]);

  const { data, error, isLoading, mutate } = useSWR(apiUrl);
  const totalCount = data?.pagination?.total || 0;

  const handleClearSearch = () => setSearchQuery("");

  const handleDelete = async (paymentId: string) => {
    if (!confirm("Are you sure you want to delete this payment?")) return;
    try {
      const response = await fetch(`/api/vendor-payments/${paymentId}`, { method: "DELETE" });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Failed to delete payment"); }
      setSelectedPayment(null);
      mutate();
    } catch (err) {
      console.error("Error deleting payment:", err);
      alert(err instanceof Error ? err.message : "Failed to delete payment");
    }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(amount);
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Vendor Payments</h1>
          <p className="text-sm text-gray-600">Manage payments to vendors</p>
        </div>

        {/* Filters and Search */}
        <div className="space-y-3 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {([{ value: "all", label: "All Payments" }, { value: "invoice", label: "Invoice Payments" }, { value: "advance", label: "Advance Payments" }] as const).map((f) => (
                <Button key={f.value} variant={paymentFilter === f.value ? "default" : "outline"} size="sm" onClick={() => { setPaymentFilter(f.value); setCurrentPage(1); }} className={paymentFilter === f.value ? "bg-teal-500 hover:bg-teal-600" : ""}>
                  {f.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Input type="text" placeholder="Search payments..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-8" />
                {searchQuery && <button onClick={handleClearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>}
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className={activeFilterCount > 0 ? "border-teal-500 text-teal-600" : ""}>
                <Filter className="h-4 w-4 mr-1" /> Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
              </Button>
              <ExportButtons
                onExportExcel={async () => { const { company } = await fetchCompanySettings(); const vpList = data?.vendorPayments || []; const headers = ["Date", "Payment #", "Vendor", "Type", "Invoice #", "Mode", "Amount"]; const rows = vpList.map((p: VendorPayment) => [fmtDateExport(p.date), p.paymentNumber, p.vendor.name, p.purchaseInvoice ? "Invoice" : "Advance", p.purchaseInvoice?.invoiceNumber || "-", p.mode, Number(p.amount)]); exportToExcel({ fileName: "Vendor-Payments.xlsx", sheets: [{ name: "Vendor Payments", headers, rows }], company }); }}
                onExportPDF={async () => { const { company } = await fetchCompanySettings(); const vpList = data?.vendorPayments || []; const headers = ["Date", "Payment #", "Vendor", "Type", "Invoice #", "Mode", "Amount"]; const rows = vpList.map((p: VendorPayment) => [fmtDateExport(p.date), p.paymentNumber, p.vendor.name, p.purchaseInvoice ? "Invoice" : "Advance", p.purchaseInvoice?.invoiceNumber || "-", p.mode, fmtNum(Number(p.amount))]); exportToPDF({ fileName: "Vendor-Payments.pdf", title: "Vendor Payments", subtitle: `Generated on ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`, sheets: [{ name: "Vendor Payments", headers, rows }], company }); }}
                disabled={isLoading || (data?.vendorPayments || []).length === 0}
              />
              <ImportButton entityType="VENDOR_PAYMENT" entityLabel="Vendor Payments" onSuccess={() => mutate()} />
              <Button size="sm" onClick={() => router.push("/purchases/payments/new")} className="bg-teal-500 hover:bg-teal-600 text-white">
                <Plus className="h-4 w-4 mr-2" /> New Payment
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-end gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="min-w-[200px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Vendor</label>
                <Select value={vendorFilter} onValueChange={(v) => { setVendorFilter(v === "ALL" ? "" : v); setCurrentPage(1); }}>
                  <SelectTrigger className="h-9 bg-white"><SelectValue placeholder="All Vendors" /></SelectTrigger>
                  <SelectContent><SelectItem value="ALL">All Vendors</SelectItem>{vendors.map((v: { id: string; name: string }) => (<SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="min-w-[150px]"><label className="block text-xs font-medium text-gray-600 mb-1">From Date</label><Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }} className="h-9 bg-white" /></div>
              <div className="min-w-[150px]"><label className="block text-xs font-medium text-gray-600 mb-1">To Date</label><Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }} className="h-9 bg-white" /></div>
              {activeFilterCount > 0 && <Button variant="ghost" size="sm" onClick={() => { setVendorFilter(""); setDateFrom(""); setDateTo(""); setCurrentPage(1); }} className="text-gray-500 hover:text-gray-700 h-9"><X className="h-3 w-3 mr-1" /> Clear</Button>}
            </div>
          )}
        </div>

        {/* Payments Table */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table aria-label="Vendor payments list">
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold w-[100px]">Date</TableHead>
                  <TableHead className="font-semibold w-[120px]">Payment #</TableHead>
                  <TableHead className="font-semibold w-[100px]">Type</TableHead>
                  <TableHead className="font-semibold">Vendor</TableHead>
                  <TableHead className="font-semibold w-[110px]">Invoice #</TableHead>
                  <TableHead className="font-semibold w-[140px]">Mode</TableHead>
                  <TableHead className="font-semibold text-right w-[140px]">Amount</TableHead>
                  <TableHead className="font-semibold w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-gray-500 py-12"><div className="flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /><span>Loading payments...</span></div></TableCell></TableRow>
                ) : error ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-red-600 py-8"><p>Error: {error.message || "Failed to load payments"}</p><Button onClick={() => mutate()} variant="outline" size="sm" className="mt-2">Try Again</Button></TableCell></TableRow>
                ) : (data?.vendorPayments || []).length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-gray-500 py-8">{searchQuery ? "No payments found" : "No vendor payments yet."}</TableCell></TableRow>
                ) : (
                  (data?.vendorPayments || []).map((payment: VendorPayment) => (
                    <TableRow key={payment.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedPayment(payment)}>
                      <TableCell className="text-sm">{formatDate(payment.date)}</TableCell>
                      <TableCell>
                        <button onClick={(e) => { e.stopPropagation(); setSelectedPayment(payment); }} className="font-medium text-teal-600 hover:text-teal-800 hover:underline">{payment.paymentNumber}</button>
                      </TableCell>
                      <TableCell>
                        {payment.purchaseInvoice ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Invoice</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700"><Wallet className="h-3 w-3 mr-1" />Advance</span>
                        )}
                      </TableCell>
                      <TableCell><div><p className="font-medium">{payment.vendor.name}</p><p className="text-xs text-gray-500">{payment.vendor.vendorNumber}</p></div></TableCell>
                      <TableCell>
                        {payment.purchaseInvoice ? (
                          <button onClick={(e) => { e.stopPropagation(); router.push(`/purchases/invoices/${payment.purchaseInvoice!.id}`); }} className="text-teal-600 hover:underline">{payment.purchaseInvoice.invoiceNumber}</button>
                        ) : <span className="text-gray-400">-</span>}
                      </TableCell>
                      <TableCell className="text-sm">{payment.mode}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(Number(payment.amount))}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600" aria-label="Actions" onClick={(e) => e.stopPropagation()}><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => router.push(`/purchases/payments/${payment.id}`)}><Eye className="h-4 w-4 mr-2" /> View Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(payment.id)} className="text-red-600"><Trash2 className="h-4 w-4 mr-2" /> Delete Payment</DropdownMenuItem>
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

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} payments</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1}>Previous</Button>
              <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Payment Detail Modal */}
      <Dialog open={!!selectedPayment} onOpenChange={(open) => { if (!open) setSelectedPayment(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{selectedPayment?.paymentNumber}</DialogTitle>
            <p className="text-sm text-gray-500">{selectedPayment ? formatDate(selectedPayment.date) : ""}</p>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {selectedPayment.purchaseInvoice ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Invoice Payment</span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700"><Wallet className="h-3 w-3 mr-1" />Advance Payment</span>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Vendor</p>
                <p className="font-medium text-gray-900">{selectedPayment.vendor.name}</p>
                <p className="text-sm text-gray-500">{selectedPayment.vendor.vendorNumber}</p>
              </div>

              <div className="flex gap-6">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Mode</p>
                  <p className="text-sm text-gray-700">{selectedPayment.mode}</p>
                </div>
                {selectedPayment.reference && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Reference</p>
                    <p className="text-sm text-gray-700">{selectedPayment.reference}</p>
                  </div>
                )}
              </div>

              {selectedPayment.purchaseInvoice && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Invoice</p>
                  <div className="bg-gray-50 rounded-md px-3 py-2 space-y-1">
                    <button onClick={() => { setSelectedPayment(null); router.push(`/purchases/invoices/${selectedPayment.purchaseInvoice!.id}`); }} className="text-sm font-medium text-teal-600 hover:underline">
                      {selectedPayment.purchaseInvoice.invoiceNumber}
                    </button>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Total: {formatCurrency(Number(selectedPayment.purchaseInvoice.totalAmount))}</span>
                      <span>Balance: {formatCurrency(Number(selectedPayment.purchaseInvoice.balanceAmount))}</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Amount</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(Number(selectedPayment.amount))}</p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => handleDelete(selectedPayment.id)} className="text-red-600 border-red-200 hover:bg-red-50">
                  <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                </Button>
                <Button size="sm" className="ml-auto bg-teal-500 hover:bg-teal-600 text-white" onClick={() => { const id = selectedPayment.id; setSelectedPayment(null); router.push(`/purchases/payments/${id}`); }}>
                  <Eye className="h-4 w-4 mr-1.5" /> View Full Details
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
