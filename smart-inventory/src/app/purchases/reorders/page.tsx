"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ReorderStatusBadge } from "@/components/reorders/ReorderStatusBadge";
import {
  Loader2, Eye, RefreshCw, ClipboardList, Clock, PackageCheck, XCircle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

interface Reorder {
  id: string;
  reorderNumber: string;
  status: string;
  createdAt: string;
  _count: { items: number; salesOrders: number };
}

const STATUS_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "CONVERTED", label: "Converted" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function ReordersPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const itemsPerPage = 15;

  const apiUrl = useMemo(() => {
    let url = `/api/reorders?page=${currentPage}&limit=${itemsPerPage}`;
    if (statusFilter !== "ALL") url += `&status=${statusFilter}`;
    return url;
  }, [currentPage, statusFilter]);

  const { data, error, isLoading, mutate } = useSWR(apiUrl);
  const reorders: Reorder[] = data?.reorders || [];
  const totalCount = data?.pagination?.total || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const stats = useMemo(() => ({
    total: totalCount,
    pending: reorders.filter((r) => r.status === "PENDING").length,
    converted: reorders.filter((r) => r.status === "CONVERTED").length,
  }), [reorders, totalCount]);

  const handleRunScan = async () => {
    setIsScanning(true);
    setScanMessage(null);
    try {
      const res = await fetch("/api/stock-scan/run", { method: "POST" });
      const result = await res.json();
      setScanMessage(result.message || "Scan complete");
      mutate();
      setTimeout(() => setScanMessage(null), 5000);
    } catch {
      setScanMessage("Failed to run scan");
    } finally {
      setIsScanning(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this reorder? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/reorders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Failed to cancel");
        return;
      }
      mutate();
    } catch {
      alert("Failed to cancel reorder");
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Reorders</h1>
          <p className="text-gray-600">
            Stock shortfall reports generated from daily scans. Convert to purchase orders.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ClipboardList className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total</p>
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
                <PackageCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Converted</p>
                <p className="text-2xl font-bold text-gray-900">{stats.converted}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters + Run Scan */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={statusFilter === f.value ? "default" : "outline"}
                size="sm"
                onClick={() => { setStatusFilter(f.value); setCurrentPage(1); }}
                className={statusFilter === f.value ? "bg-teal-500 hover:bg-teal-600" : ""}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <Button
            onClick={handleRunScan}
            disabled={isScanning}
            className="bg-teal-500 hover:bg-teal-600 text-white"
          >
            {isScanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Run Scan Now
          </Button>
        </div>

        {/* Scan message */}
        {scanMessage && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm">
            {scanMessage}
          </div>
        )}

        {/* Table */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <Table aria-label="Reorders list">
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Reorder No.</TableHead>
                <TableHead className="font-semibold">Created At</TableHead>
                <TableHead className="font-semibold text-center">Items</TableHead>
                <TableHead className="font-semibold text-center">Affected Orders</TableHead>
                <TableHead className="font-semibold text-center">Status</TableHead>
                <TableHead className="font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-12">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading reorders...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-red-600 py-8">
                    <div className="space-y-2">
                      <p>Failed to load reorders</p>
                      <Button onClick={() => mutate()} variant="outline" size="sm">Try Again</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : reorders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    No reorders found. Click &quot;Run Scan Now&quot; to check for stock shortfalls.
                  </TableCell>
                </TableRow>
              ) : (
                reorders.map((ro) => (
                  <TableRow key={ro.id} className="hover:bg-gray-50">
                    <TableCell>
                      <button
                        onClick={() => router.push(`/purchases/reorders/${ro.id}`)}
                        className="font-medium text-teal-600 hover:text-teal-800 hover:underline"
                      >
                        {ro.reorderNumber}
                      </button>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{formatDate(ro.createdAt)}</TableCell>
                    <TableCell className="text-center text-sm">{ro._count.items}</TableCell>
                    <TableCell className="text-center text-sm">{ro._count.salesOrders}</TableCell>
                    <TableCell className="text-center">
                      <ReorderStatusBadge status={ro.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => router.push(`/purchases/reorders/${ro.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        {ro.status === "PENDING" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-red-600 hover:text-red-700"
                            onClick={() => handleCancel(ro.id)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
              <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
