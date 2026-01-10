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
import { Badge } from "@/components/ui/badge";
import { AddRateSheetModal } from "@/components/rate-sheets/AddRateSheetModal";
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  X,
  FileSpreadsheet,
  Users,
  Percent,
  Filter,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";

interface Customer {
  id: string;
  customerNumber: string;
  name: string;
  gstin: string;
  city: string;
  state: string;
}

interface RateSheet {
  id: string;
  name: string;
  customerId: string;
  validFrom: string;
  validTo: string | null;
  itemRatePercent: number;
  discountPercent: number;
  currency: string;
  roundOff: string;
  isActive: boolean;
  createdAt: string;
  customer: Customer;
}

export default function RateSheetsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [rateSheets, setRateSheets] = useState<RateSheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [editingRateSheet, setEditingRateSheet] = useState<RateSheet | null>(null);
  const itemsPerPage = 15;

  // Fetch rate sheets from API
  useEffect(() => {
    fetchRateSheets();
  }, [showActiveOnly]);

  const fetchRateSheets = async () => {
    try {
      setIsLoading(true);
      setError(null);

      let url = "/api/rate-sheets?limit=500";
      if (showActiveOnly) {
        url += "&activeOnly=true";
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch rate sheets");
      }

      const data = await response.json();
      setRateSheets(data.rateSheets || []);
    } catch (err: any) {
      setError(err.message);
      console.error("Error fetching rate sheets:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter rate sheets based on search query
  const filteredRateSheets = useMemo(() => {
    if (!searchQuery.trim()) return rateSheets;

    const query = searchQuery.toLowerCase();
    return rateSheets.filter(
      (rs) =>
        rs.name.toLowerCase().includes(query) ||
        rs.customer.name.toLowerCase().includes(query) ||
        rs.customer.customerNumber.toLowerCase().includes(query)
    );
  }, [searchQuery, rateSheets]);

  // Paginate rate sheets
  const paginatedRateSheets = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredRateSheets.slice(startIndex, endIndex);
  }, [filteredRateSheets, currentPage]);

  const totalPages = Math.ceil(filteredRateSheets.length / itemsPerPage);

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleEdit = (rateSheet: RateSheet) => {
    setEditingRateSheet(rateSheet);
    setShowAddModal(true);
  };

  const handleDelete = async (rateSheetId: string) => {
    if (!confirm("Are you sure you want to delete this rate sheet?")) {
      return;
    }

    try {
      const response = await fetch(`/api/rate-sheets/${rateSheetId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete rate sheet");
      }

      // Refresh the list
      fetchRateSheets();
    } catch (err: any) {
      console.error("Error deleting rate sheet:", err);
      alert("Failed to delete rate sheet: " + err.message);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Check if rate sheet is currently valid
  const isRateSheetValid = (rs: RateSheet) => {
    const now = new Date();
    const validFrom = new Date(rs.validFrom);
    const validTo = rs.validTo ? new Date(rs.validTo) : null;

    if (!rs.isActive) return false;
    if (validFrom > now) return false;
    if (validTo && validTo < now) return false;
    return true;
  };

  // Calculate effective discount
  const getEffectiveDiscount = (rs: RateSheet) => {
    const itemRate = Number(rs.itemRatePercent);
    const discount = Number(rs.discountPercent);
    // Effective = 100 - (itemRatePercent * (1 - discountPercent/100))
    const effectiveRate = itemRate * (1 - discount / 100);
    return Math.round((100 - effectiveRate) * 100) / 100;
  };

  const activeCount = rateSheets.filter((rs) => rs.isActive).length;
  const validCount = rateSheets.filter((rs) => isRateSheetValid(rs)).length;

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Rate Sheets</h1>
          <p className="text-gray-600">
            Manage customer-specific pricing and discounts that apply to all orders
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileSpreadsheet className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Rate Sheets</p>
                <p className="text-2xl font-bold text-gray-900">
                  {rateSheets.length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Currently Active</p>
                <p className="text-2xl font-bold text-gray-900">{validCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Customers with Discounts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {rateSheets.filter((rs) => getEffectiveDiscount(rs) > 0).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search, Filter and Add Button */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative w-64">
              <Input
                type="text"
                placeholder="Search by name or customer..."
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
            <Button
              variant={showActiveOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowActiveOnly(!showActiveOnly)}
              className={showActiveOnly ? "bg-teal-500 hover:bg-teal-600" : ""}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showActiveOnly ? "Active Only" : "Show All"}
            </Button>
          </div>
          <Button
            onClick={() => {
              setEditingRateSheet(null);
              setShowAddModal(true);
            }}
            className="bg-teal-500 hover:bg-teal-600 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Rate Sheet
          </Button>
        </div>

        {searchQuery && (
          <p className="text-sm text-gray-600 mb-4">
            Found {filteredRateSheets.length} rate sheet
            {filteredRateSheets.length !== 1 ? "s" : ""}
          </p>
        )}

        {/* Rate Sheets Table */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <Table aria-label="Rate sheets list">
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead scope="col" className="font-semibold">
                  Name
                </TableHead>
                <TableHead scope="col" className="font-semibold">
                  Customer
                </TableHead>
                <TableHead scope="col" className="font-semibold text-center">
                  Item Rate %
                </TableHead>
                <TableHead scope="col" className="font-semibold text-center">
                  Discount %
                </TableHead>
                <TableHead scope="col" className="font-semibold text-center">
                  Effective Discount
                </TableHead>
                <TableHead scope="col" className="font-semibold">
                  Valid From
                </TableHead>
                <TableHead scope="col" className="font-semibold">
                  Valid To
                </TableHead>
                <TableHead scope="col" className="font-semibold">
                  Currency
                </TableHead>
                <TableHead scope="col" className="font-semibold text-center">
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
                    colSpan={10}
                    className="text-center text-gray-500 py-12"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading rate sheets...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-center text-red-600 py-8"
                  >
                    <div className="space-y-2">
                      <p>Error: {error}</p>
                      <Button
                        onClick={fetchRateSheets}
                        variant="outline"
                        size="sm"
                      >
                        Try Again
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedRateSheets.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-center text-gray-500 py-8"
                  >
                    {searchQuery
                      ? "No rate sheets found matching your search"
                      : "No rate sheets yet. Click 'New Rate Sheet' to create customer-specific pricing."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRateSheets.map((rateSheet) => {
                  const isValid = isRateSheetValid(rateSheet);
                  const effectiveDiscount = getEffectiveDiscount(rateSheet);
                  const isExpired =
                    rateSheet.validTo && new Date(rateSheet.validTo) < new Date();
                  const isPending =
                    new Date(rateSheet.validFrom) > new Date();

                  return (
                    <TableRow key={rateSheet.id}>
                      <TableCell className="font-medium">
                        {rateSheet.name}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{rateSheet.customer.name}</p>
                          <p className="text-xs text-gray-500">
                            {rateSheet.customer.customerNumber}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={
                            Number(rateSheet.itemRatePercent) < 100
                              ? "text-green-600 font-medium"
                              : "text-gray-600"
                          }
                        >
                          {rateSheet.itemRatePercent}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {Number(rateSheet.discountPercent) > 0 ? (
                          <span className="text-orange-600 font-medium">
                            {rateSheet.discountPercent}%
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {effectiveDiscount > 0 ? (
                          <Badge className="bg-green-100 text-green-700">
                            <Percent className="h-3 w-3 mr-1" />
                            {effectiveDiscount.toFixed(1)}% off
                          </Badge>
                        ) : (
                          <span className="text-gray-400">No discount</span>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(rateSheet.validFrom)}</TableCell>
                      <TableCell>
                        {rateSheet.validTo
                          ? formatDate(rateSheet.validTo)
                          : "No expiry"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{rateSheet.currency}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {!rateSheet.isActive ? (
                          <Badge variant="secondary" className="bg-gray-100">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </Badge>
                        ) : isExpired ? (
                          <Badge variant="destructive" className="bg-red-100 text-red-700">
                            Expired
                          </Badge>
                        ) : isPending ? (
                          <Badge className="bg-yellow-100 text-yellow-700">
                            Pending
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
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
                            <DropdownMenuItem onClick={() => handleEdit(rateSheet)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(rateSheet.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
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
              {Math.min(currentPage * itemsPerPage, filteredRateSheets.length)} of{" "}
              {filteredRateSheets.length} rate sheets
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

        {/* Add/Edit Rate Sheet Modal */}
        <AddRateSheetModal
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setEditingRateSheet(null);
          }}
          onSuccess={() => {
            fetchRateSheets();
            setCurrentPage(1);
          }}
          editingRateSheet={editingRateSheet}
        />
      </div>
    </DashboardLayout>
  );
}
