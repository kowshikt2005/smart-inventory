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
} from "lucide-react";
import { ImportButton } from "@/components/import/ImportButton";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
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

export default function VendorsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const itemsPerPage = 10;

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

  const handleToggleStatus = async (vendor: Vendor) => {
    setTogglingId(vendor.id);
    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !vendor.isActive }),
      });
      if (!res.ok) throw new Error();
      mutate();
    } catch {
      alert("Failed to update vendor status.");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">All Vendors</h1>

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
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="text-sm text-gray-600 mt-2">
                  Found {filteredVendors.length} vendor
                  {filteredVendors.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ImportButton entityType="VENDOR" entityLabel="Vendors" onSuccess={() => mutate()} />
              <Button
                onClick={() => setShowAddModal(true)}
                className="bg-teal-500 hover:bg-teal-600 text-white"
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

        {/* Vendors Table */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <Table aria-label="Vendor list">
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead scope="col" className="font-semibold">
                  Name
                </TableHead>
                <TableHead scope="col" className="font-semibold">
                  GST No.
                </TableHead>
                <TableHead scope="col" className="font-semibold">
                  City
                </TableHead>
                <TableHead scope="col" className="font-semibold">
                  State
                </TableHead>
                <TableHead scope="col" className="font-semibold">
                  Credit Days
                </TableHead>
                <TableHead scope="col" className="font-semibold">
                  Credit Limit
                </TableHead>
                <TableHead scope="col" className="font-semibold">
                  Status
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
                      <span>Loading vendors...</span>
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
                      <p>Error: {error.message || "Failed to load vendors"}</p>
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
              ) : paginatedVendors.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-gray-500 py-8"
                  >
                    {searchQuery
                      ? "No vendors found matching your search"
                      : "No vendors yet. Click 'Add Vendor' to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedVendors.map((vendor: Vendor) => (
                  <TableRow
                    key={vendor.id}
                    className={!vendor.isActive ? "opacity-50 bg-muted/20" : undefined}
                  >
                    <TableCell className="font-medium">{vendor.name}</TableCell>
                    <TableCell>{vendor.gstin || "N/A"}</TableCell>
                    <TableCell>{vendor.city || "N/A"}</TableCell>
                    <TableCell>{vendor.state || "N/A"}</TableCell>
                    <TableCell>{vendor.creditDays}</TableCell>
                    <TableCell>
                      {vendor.openingBalance.toLocaleString("en-US")}
                    </TableCell>
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
                          >
                            {togglingId === vendor.id ? (
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
            <p className="text-sm text-gray-600">
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

        {/* Add Vendor Modal */}
        <AddVendorModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            mutate();
            setCurrentPage(1);
          }}
        />
      </div>
    </DashboardLayout>
  );
}
