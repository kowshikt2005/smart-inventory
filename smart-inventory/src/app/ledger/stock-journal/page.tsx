"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Plus, MoreHorizontal, Trash2, Loader2, X, FileText } from "lucide-react";
import { ImportButton } from "@/components/import/ImportButton";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { exportToExcel, exportToPDF, fmtDateExport, fetchCompanySettings } from "@/lib/export-utils";
import { useState, useMemo } from "react";
import useSWR from "swr";
import { useDebounce } from "@/hooks/useDebounce";
import { AddStockJournalModal } from "@/components/stock-journal/AddStockJournalModal";

interface StockJournal {
  id: string;
  journalNumber: string;
  date: string;
  itemId: string;
  quantity: number | string;
  type: string;
  reason: string | null;
  createdAt: string;
  item?: {
    id: string;
    itemCode: string;
    name: string;
    unit: string;
  };
  user?: {
    id: string;
    name: string;
  };
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  ADJUSTMENT_IN: { label: "Stock In", color: "bg-green-100 text-green-800" },
  ADJUSTMENT_OUT: { label: "Stock Out", color: "bg-red-100 text-red-800" },
};

export default function StockJournalPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const itemsPerPage = 10;

  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data, error, isLoading, mutate } = useSWR("/api/stock-journals?limit=500");

  // Filter journals based on search
  const filteredJournals = useMemo(() => {
    const journals: StockJournal[] = data?.journals || [];
    if (!debouncedSearch.trim()) return journals;
    const query = debouncedSearch.toLowerCase();
    return journals.filter(
      (j) =>
        j.journalNumber.toLowerCase().includes(query) ||
        j.item?.name.toLowerCase().includes(query) ||
        j.item?.itemCode.toLowerCase().includes(query) ||
        j.reason?.toLowerCase().includes(query)
    );
  }, [debouncedSearch, data]);

  // Paginate
  const paginatedJournals = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredJournals.slice(start, start + itemsPerPage);
  }, [filteredJournals, currentPage]);

  const totalPages = Math.ceil(filteredJournals.length / itemsPerPage);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/stock-journals/${deleteId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        mutate();
      }
    } catch (err) {
      console.error("Error deleting journal:", err);
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  // Format date only
  const formatDateOnly = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Format time from createdAt (actual entry timestamp)
  const formatTimeOnly = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    // Check if it's a valid date
    if (isNaN(date.getTime())) return '-';
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = (hours % 12 || 12).toString().padStart(2, '0');
    return `${displayHours}:${minutes} ${ampm}`;
  };

  const _formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Stock Journal</h1>
          <p className="text-gray-600">Manual stock adjustments and inventory corrections</p>
        </div>

        {/* Search and Add Button */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search journals..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pr-8"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearchChange("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-sm text-gray-600 mt-2">
                Found {filteredJournals.length} journal{filteredJournals.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ExportButtons
              onExportExcel={async () => {
                const { company } = await fetchCompanySettings();
                const headers = ["Journal No", "Date", "Item", "Item Code", "Type", "Quantity", "Reason"];
                const rows = filteredJournals.map((j) => [j.journalNumber, fmtDateExport(j.date), j.item?.name || "Unknown", j.item?.itemCode || "", j.type, Number(j.quantity), j.reason || "-"]);
                exportToExcel({ fileName: `Stock-Journal.xlsx`, sheets: [{ name: "Stock Journal", headers, rows }], company });
              }}
              onExportPDF={async () => {
                const { company } = await fetchCompanySettings();
                const headers = ["Journal No", "Date", "Item", "Item Code", "Type", "Quantity", "Reason"];
                const rows = filteredJournals.map((j) => [j.journalNumber, fmtDateExport(j.date), j.item?.name || "Unknown", j.item?.itemCode || "", j.type === "ADJUSTMENT_IN" ? "Stock In" : "Stock Out", `${Number(j.quantity).toFixed(3)} ${j.item?.unit || ""}`, j.reason || "-"]);
                exportToPDF({ fileName: `Stock-Journal.pdf`, title: "Stock Journal", subtitle: `Generated on ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`, sheets: [{ name: "Stock Journal", headers, rows }], company });
              }}
              disabled={isLoading || filteredJournals.length === 0}
            />
            <ImportButton entityType="STOCK_JOURNAL" entityLabel="Stock Journals" onSuccess={() => mutate()} />
            <Button
              className="bg-teal-500 hover:bg-teal-600 text-white"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Journal
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Journal No</TableHead>
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold">Time</TableHead>
                <TableHead className="font-semibold">Item</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold text-right">Quantity</TableHead>
                <TableHead className="font-semibold">Reason</TableHead>
                <TableHead className="font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading journals...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-red-600 py-8">
                    <p>Error loading journals</p>
                    <Button onClick={() => mutate()} variant="outline" size="sm" className="mt-2">
                      Try Again
                    </Button>
                  </TableCell>
                </TableRow>
              ) : paginatedJournals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-500 py-12">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>
                      {searchQuery
                        ? "No journals found matching your search"
                        : "No stock journals yet. Click 'Add Journal' to create one."}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedJournals.map((journal) => {
                  const typeInfo = TYPE_LABELS[journal.type] || { label: journal.type, color: "bg-gray-100 text-gray-800" };
                  return (
                    <TableRow key={journal.id} className="hover:bg-gray-50">
                      <TableCell className="font-mono font-medium">{journal.journalNumber}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateOnly(journal.date)}</TableCell>
                      <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                        {formatTimeOnly(journal.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{journal.item?.name || "Unknown"}</p>
                          <p className="text-xs text-gray-500">{journal.item?.itemCode}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {Number(journal.quantity).toFixed(3)} {journal.item?.unit || ""}
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={journal.reason || ""}>
                        {journal.reason || "-"}
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
                              onClick={() => setDeleteId(journal.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete & Reverse
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredJournals.length)} of{" "}
              {filteredJournals.length} journals
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Add Modal */}
        <AddStockJournalModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            mutate();
            setCurrentPage(1);
          }}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Stock Journal?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete the journal entry and reverse the inventory changes.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? "Deleting..." : "Delete & Reverse"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
