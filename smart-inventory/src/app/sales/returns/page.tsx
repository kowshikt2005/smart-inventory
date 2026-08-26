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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  MoreVertical,
  Loader2,
  X,
  Eye,
  CheckCircle2,
  Ban,
  Trash2,
  Filter,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [selectedReturn, setSelectedReturn] = useState<SalesReturn | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: "complete" | "cancel" | "delete"; id: string; label?: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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
    if (statusFilter !== "ALL") url += `&status=${statusFilter}`;
    if (brandFilter) url += `&brandId=${brandFilter}`;
    if (customerFilter) url += `&customerId=${customerFilter}`;
    if (dateFrom) url += `&dateFrom=${dateFrom}`;
    if (dateTo) url += `&dateTo=${dateTo}`;
    if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;
    return url;
  }, [currentPage, statusFilter, brandFilter, customerFilter, dateFrom, dateTo, debouncedSearch]);

  // Use SWR for caching
  const { data, error, isLoading, mutate } = useSWR(apiUrl);
  const totalCount = data?.pagination?.total || 0;

  const handleClearSearch = () => {
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleComplete = (returnId: string) => setConfirmAction({ type: "complete", id: returnId });
  const handleCancel = (returnId: string) => setConfirmAction({ type: "cancel", id: returnId });
  const handleDelete = (returnId: string) => setConfirmAction({ type: "delete", id: returnId });

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    setActionError(null);
    const { type, id } = confirmAction;
    setConfirmAction(null);
    try {
      const url = type === "delete"
        ? `/api/sales-returns/${id}`
        : `/api/sales-returns/${id}/${type}`;
      const method = type === "delete" ? "DELETE" : "POST";
      const response = await fetch(url, { method });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to ${type} return`);
      }
      setSelectedReturn(null);
      mutate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to ${type} return`);
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
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground mb-2">Sales Returns</h1>
          <p className="text-sm text-muted-foreground">Manage goods returned by customers</p>
        </div>

        {actionError && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="ml-4 text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

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
                  className={statusFilter === filter.value ? "bg-primary hover:bg-primary/90" : ""}
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
                size="sm"
                onClick={() => router.push("/sales/returns/new")}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Return
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-end gap-3 p-4 bg-muted/30 rounded-lg border border-border">
              <div className="min-w-[160px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Brand</label>
                <Select value={brandFilter} onValueChange={(v) => { setBrandFilter(v === "ALL" ? "" : v); setCurrentPage(1); }}>
                  <SelectTrigger className="h-9 bg-white"><SelectValue placeholder="All Brands" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Brands</SelectItem>
                    {brands.map((brand: { id: string; name: string }) => (
                      <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[200px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Customer</label>
                <Select value={customerFilter} onValueChange={(v) => { setCustomerFilter(v === "ALL" ? "" : v); setCurrentPage(1); }}>
                  <SelectTrigger className="h-9 bg-white"><SelectValue placeholder="All Customers" /></SelectTrigger>
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
                <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }} className="h-9 bg-white" />
              </div>
              <div className="min-w-[150px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
                <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }} className="h-9 bg-white" />
              </div>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => { setBrandFilter(""); setCustomerFilter(""); setDateFrom(""); setDateTo(""); setCurrentPage(1); }} className="text-muted-foreground hover:text-foreground h-9">
                  <X className="h-3 w-3 mr-1" /> Clear
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Returns Table */}
        <div className="rounded-xl border border-border/60 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table aria-label="Sales returns list">
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead scope="col" className="font-semibold text-center w-[60px]">S.No.</TableHead>
                  <TableHead scope="col" className="font-semibold w-[100px]">Date</TableHead>
                  <TableHead scope="col" className="font-semibold w-[110px]">Return #</TableHead>
                  <TableHead scope="col" className="font-semibold">Customer</TableHead>
                  <TableHead scope="col" className="font-semibold w-[110px]">Invoice</TableHead>
                  <TableHead scope="col" className="font-semibold w-[200px]">Reason</TableHead>
                  <TableHead scope="col" className="font-semibold text-center w-[110px]">Status</TableHead>
                  <TableHead scope="col" className="font-semibold text-right w-[130px]">Amount</TableHead>
                  <TableHead scope="col" className="font-semibold w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Loading returns...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-red-600 py-8">
                      <div className="space-y-2">
                        <p>Error: {error?.message || "Failed to load returns"}</p>
                        <Button onClick={() => mutate()} variant="outline" size="sm">Try Again</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (data?.salesReturns || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      {searchQuery || statusFilter !== "ALL"
                        ? "No returns found matching your filters"
                        : "No sales returns yet. Click 'New Return' to create one."}
                    </TableCell>
                  </TableRow>
                ) : (
                  (data?.salesReturns || []).map((ret: SalesReturn, rowIndex: number) => (
                    <TableRow key={ret.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedReturn(ret)}>
                      <TableCell className="text-center text-muted-foreground">{(currentPage - 1) * itemsPerPage + rowIndex + 1}</TableCell>
                      <TableCell className="text-sm">{formatDate(ret.returnDate)}</TableCell>
                      <TableCell>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedReturn(ret); }}
                          className="font-medium text-primary hover:text-primary/80 hover:underline"
                        >
                          {ret.returnNumber}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{ret.customer.name}</p>
                          <p className="text-xs text-muted-foreground">{ret.customer.customerNumber}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {ret.invoice ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/sales/invoices/${ret.invoice!.id}`); }}
                            className="text-primary hover:underline"
                          >
                            {ret.invoice.invoiceNumber}
                          </button>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
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
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground/60 hover:text-muted-foreground" aria-label="Actions" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => router.push(`/sales/returns/${ret.id}`)}>
                              <Eye className="h-4 w-4 mr-2 text-primary" /> View Details
                            </DropdownMenuItem>
                            {ret.status === "OPEN" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleComplete(ret.id)}>
                                  <CheckCircle2 className="h-4 w-4 mr-2" /> Complete Return
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleCancel(ret.id)} className="text-orange-600">
                                  <Ban className="h-4 w-4 mr-2" /> Cancel Return
                                </DropdownMenuItem>
                              </>
                            )}
                            {(ret.status === "OPEN" || ret.status === "CANCELLED") && (
                              <DropdownMenuItem onClick={() => handleDelete(ret.id)} className="text-red-600">
                                <Trash2 className="h-4 w-4 mr-2" /> Delete Return
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
              {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} returns
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1}>Previous</Button>
              <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>Next</Button>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "complete" && "Complete this return?"}
              {confirmAction?.type === "cancel" && "Cancel this return?"}
              {confirmAction?.type === "delete" && "Delete this return?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "complete" && "This will restore inventory and create a credit ledger entry. This cannot be undone."}
              {confirmAction?.type === "cancel" && "The return will be marked as cancelled. This cannot be undone."}
              {confirmAction?.type === "delete" && "This return will be permanently deleted. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeConfirmAction}
              className={
                confirmAction?.type === "complete"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700 focus:ring-red-600"
              }
            >
              {confirmAction?.type === "complete" && "Complete"}
              {confirmAction?.type === "cancel" && "Cancel Return"}
              {confirmAction?.type === "delete" && "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Return Detail Modal */}
      <Dialog open={!!selectedReturn} onOpenChange={(open) => { if (!open) setSelectedReturn(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle className="text-lg font-bold">{selectedReturn?.returnNumber}</DialogTitle>
              {selectedReturn && <ReturnStatusBadge status={selectedReturn.status} />}
            </div>
            <p className="text-sm text-gray-500">{selectedReturn ? formatDate(selectedReturn.returnDate) : ""}</p>
          </DialogHeader>

          {selectedReturn && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Customer</p>
                <p className="font-medium text-foreground">{selectedReturn.customer.name}</p>
                <p className="text-sm text-muted-foreground">{selectedReturn.customer.customerNumber}</p>
              </div>

              {selectedReturn.invoice && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Invoice</p>
                  <button
                    onClick={() => { setSelectedReturn(null); router.push(`/sales/invoices/${selectedReturn.invoice!.id}`); }}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {selectedReturn.invoice.invoiceNumber}
                  </button>
                </div>
              )}

              {selectedReturn.reason && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Reason</p>
                  <p className="text-sm text-gray-700">{selectedReturn.reason}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Amount</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">{formatCurrency(Number(selectedReturn.subtotal))}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="text-foreground">{formatCurrency(Number(selectedReturn.taxAmount))}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-1.5">
                    <span>Total</span>
                    <span className="text-lg text-foreground">{formatCurrency(Number(selectedReturn.totalAmount))}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                {selectedReturn.status === "OPEN" && (
                  <>
                    <Button size="sm" onClick={() => handleComplete(selectedReturn.id)} className="bg-green-600 hover:bg-green-700 text-white">
                      <CheckCircle2 className="h-4 w-4 mr-1.5" /> Complete
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleCancel(selectedReturn.id)} className="text-orange-600 border-orange-200 hover:bg-orange-50">
                      <Ban className="h-4 w-4 mr-1.5" /> Cancel
                    </Button>
                  </>
                )}
                {(selectedReturn.status === "OPEN" || selectedReturn.status === "CANCELLED") && (
                  <Button size="sm" variant="outline" onClick={() => handleDelete(selectedReturn.id)} className="text-red-600 border-red-200 hover:bg-red-50">
                    <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                  </Button>
                )}
                <Button
                  size="sm"
                  className="ml-auto bg-primary hover:bg-primary/90 text-white"
                  onClick={() => { const id = selectedReturn.id; setSelectedReturn(null); router.push(`/sales/returns/${id}`); }}
                >
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
