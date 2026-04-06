"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { AddVendorModal } from "@/components/vendors/AddVendorModal";
import {
  Plus,
  MoreHorizontal,
  Eye,
  FileText,
  Loader2,
  X,
  PowerOff,
  Power,
  Edit,
  Trash2,
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
import { ImportButton } from "@/components/import/ImportButton";
import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useDebounce } from "@/hooks/useDebounce";

interface Vendor {
  id: string;
  vendorNumber: string;
  name: string;
  gstin: string | null;
  city: string | null;
  state: string | null;
  creditDays: number;
  openingBalance: number;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  pincode?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

function VendorsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const purchaseInvoiceId = searchParams.get("purchaseInvoiceId");
  const prefillName = searchParams.get("prefillName") || undefined;

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmVendor, setDeleteConfirmVendor] = useState<Vendor | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const itemsPerPage = 10;

  // Auto-open modal when redirected from an invoice page
  useEffect(() => {
    if (searchParams.get("openCreate") === "true") {
      setShowAddModal(true);
    }
  }, [searchParams]);

  // Debounce search
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Use SWR for caching
  const { data, error, isLoading, mutate } = useSWR("/api/vendors?limit=1000");

  // Counts for filter tabs
  const counts = useMemo(() => {
    const vendors: Vendor[] = data?.vendors || [];
    return {
      all: vendors.length,
      active: vendors.filter((v) => v.isActive).length,
      inactive: vendors.filter((v) => !v.isActive).length,
    };
  }, [data]);

  // Filter vendors based on search query and status filter
  const filteredVendors = useMemo(() => {
    const vendors: Vendor[] = data?.vendors || [];

    let result = vendors;

    if (statusFilter !== "ALL") {
      result = result.filter(
        (vendor) => vendor.isActive === (statusFilter === "ACTIVE")
      );
    }

    if (!debouncedSearch.trim()) return result;

    const query = debouncedSearch.toLowerCase();
    return result.filter(
      (vendor) =>
        vendor.name.toLowerCase().includes(query) ||
        (vendor.gstin && vendor.gstin.toLowerCase().includes(query)) ||
        (vendor.city && vendor.city.toLowerCase().includes(query)) ||
        (vendor.state && vendor.state.toLowerCase().includes(query))
    );
  }, [debouncedSearch, data, statusFilter]);

  // Paginate vendors
  const paginatedVendors = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredVendors.slice(startIndex, endIndex);
  }, [filteredVendors, currentPage]);

  const totalPages = Math.ceil(filteredVendors.length / itemsPerPage);

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleViewDetails = (vendorId: string) => {
    router.push(`/masters/vendors/${vendorId}`);
  };

  const handleViewTransactions = (vendorId: string) => {
    router.push(`/ledger/vendors?vendorId=${vendorId}`);
  };

  const handleDeleteVendor = (vendor: Vendor) => {
    setDeleteConfirmVendor(vendor);
  };

  const executeDeleteVendor = async () => {
    if (!deleteConfirmVendor) return;
    setDeletingId(deleteConfirmVendor.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/vendors/${deleteConfirmVendor.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to delete");
      }
      mutate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete vendor");
    } finally {
      setDeletingId(null);
      setDeleteConfirmVendor(null);
    }
  };

  const handleToggleStatus = async (vendor: Vendor) => {
    setTogglingId(vendor.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !vendor.isActive }),
      });
      if (!res.ok) throw new Error();
      mutate();
    } catch {
      setActionError("Failed to update vendor status. Please try again.");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-6">All Vendors</h1>

          {/* Search and Add Button */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search vendors..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pr-8"
                />
                {searchQuery && (
                  <button
                    onClick={() => handleSearchChange("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="text-sm text-muted-foreground mt-2">
                  Found {filteredVendors.length} vendor{filteredVendors.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ImportButton entityType="VENDOR" entityLabel="Vendors" onSuccess={() => mutate()} />
              <Button
                onClick={() => setShowAddModal(true)}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Vendor
              </Button>
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex gap-1 border-b border-border mb-0">
            {(["ALL", "ACTIVE", "INACTIVE"] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setStatusFilter(f);
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  statusFilter === f
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "ALL" ? "All" : f === "ACTIVE" ? "Active" : "Inactive"}
                <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">
                  {f === "ALL" ? counts.all : f === "ACTIVE" ? counts.active : counts.inactive}
                </span>
              </button>
            ))}
          </div>
        </div>

        {actionError && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="ml-4 text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {/* Vendors Table */}
        <div className="rounded-xl border border-border/60 bg-white shadow-sm overflow-hidden">
          <Table aria-label="Vendor list">
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">GSTIN</TableHead>
                <TableHead className="font-semibold">City</TableHead>
                <TableHead className="font-semibold">State</TableHead>
                <TableHead className="font-semibold">Credit Days</TableHead>
                <TableHead className="font-semibold">Opening Balance</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading vendors...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-red-600 py-8">
                    <div className="space-y-2">
                      <p>Error: {error.message || "Failed to load vendors"}</p>
                      <Button onClick={() => mutate()} variant="outline" size="sm">Try Again</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedVendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {searchQuery ? "No vendors found matching your search" : "No vendors yet. Click 'Add Vendor' to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedVendors.map((vendor: Vendor) => (
                  <TableRow
                    key={vendor.id}
                    className={!vendor.isActive ? "opacity-50 bg-muted/20" : undefined}
                  >
                    <TableCell className="font-medium">{vendor.name}</TableCell>
                    <TableCell className="font-mono text-sm">{vendor.gstin || "-"}</TableCell>
                    <TableCell>{vendor.city || "-"}</TableCell>
                    <TableCell>{vendor.state || "-"}</TableCell>
                    <TableCell>{vendor.creditDays} days</TableCell>
                    <TableCell>₹{Number(vendor.openingBalance).toLocaleString("en-IN")}</TableCell>
                    <TableCell>
                      {vendor.isActive ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            aria-label={`Actions for ${vendor.name}`}
                            disabled={togglingId === vendor.id || deletingId === vendor.id}
                          >
                            {togglingId === vendor.id || deletingId === vendor.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleViewDetails(vendor.id)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleViewTransactions(vendor.id)}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            View Transactions
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => router.push(`/masters/vendors/${vendor.id}`)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Vendor
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleToggleStatus(vendor)}
                            className={!vendor.isActive ? "text-green-600" : "text-orange-600"}
                          >
                            {!vendor.isActive ? (
                              <>
                                <Power className="h-4 w-4 mr-2" />
                                Activate
                              </>
                            ) : (
                              <>
                                <PowerOff className="h-4 w-4 mr-2" />
                                Deactivate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteVendor(vendor)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Vendor
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredVendors.length)} of{" "}
              {filteredVendors.length} vendors
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
              <span className="text-sm text-muted-foreground">
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

        <AlertDialog open={!!deleteConfirmVendor} onOpenChange={(open) => { if (!open) setDeleteConfirmVendor(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete vendor?</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>&ldquo;{deleteConfirmVendor?.name}&rdquo;</strong> will be permanently deleted. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={!!deletingId}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={executeDeleteVendor}
                disabled={!!deletingId}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {deletingId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add Vendor Modal */}
        <AddVendorModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          prefillName={prefillName}
          onSuccess={async (vendor) => {
            mutate();
            setCurrentPage(1);
            // If opened from an invoice, link the new vendor and redirect back
            if (returnTo && purchaseInvoiceId) {
              try {
                await fetch("/api/import/link-invoice-vendor", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ vendorId: vendor.id, purchaseInvoiceId }),
                });
              } catch {
                // Linking failed silently — user is still redirected
              }
              router.push(returnTo);
            }
          }}
        />
      </div>
    </DashboardLayout>
  );
}

export default function VendorsPage() {
  return (
    <Suspense>
      <VendorsContent />
    </Suspense>
  );
}
