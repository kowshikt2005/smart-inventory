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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, MoreHorizontal, Edit, Loader2, X } from "lucide-react";
import { useState, useMemo, useEffect, useCallback } from "react";

interface Brand {
  id: string;
  name: string;
}

interface SubBrand {
  id: string;
  name: string;
  brandId: string;
  discountPercent: number | null;
  brand?: { name: string };
  createdAt: string;
  updatedAt: string;
}

export default function SubBrandsPage() {
  const [subBrands, setSubBrands] = useState<SubBrand[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSubBrand, setEditingSubBrand] = useState<SubBrand | null>(null);
  const [newSubBrand, setNewSubBrand] = useState({ name: "", brandId: "", discountPercent: "" });
  const itemsPerPage = 10;

  const fetchBrands = useCallback(async () => {
    const response = await fetch("/api/brands");
    if (!response.ok) {
      throw new Error("Failed to fetch brands");
    }
    const data = await response.json();
    setBrands(data.brands || []);
    return data.brands || [];
  }, []);

  const fetchSubBrands = useCallback(async (brandsData?: Brand[]) => {
    // Get all brands first, then fetch sub-brands for each
    const brandsToUse = brandsData || await fetchBrands();
    const allSubBrands: SubBrand[] = [];

    for (const brand of brandsToUse) {
      try {
        const response = await fetch(`/api/brands/${brand.id}/sub-brands`);
        if (response.ok) {
          const data = await response.json();
          const subBrandsWithBrand = data.subBrands.map((sb: SubBrand) => ({
            ...sb,
            brand: { name: brand.name },
          }));
          allSubBrands.push(...subBrandsWithBrand);
        }
      } catch (error) {
        console.error(`Error fetching sub-brands for brand ${brand.id}:`, error);
      }
    }

    setSubBrands(allSubBrands);
  }, [fetchBrands]);

  const fetchAllData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const brandsData = await fetchBrands();
      await fetchSubBrands(brandsData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("Error fetching data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchBrands, fetchSubBrands]);

  // Fetch data from API
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleAddSubBrand = async () => {
    try {
      const payload = {
        name: newSubBrand.name,
        discountPercent: newSubBrand.discountPercent ? parseFloat(newSubBrand.discountPercent) : null,
      };

      const response = await fetch(`/api/brands/${newSubBrand.brandId}/sub-brands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setShowAddModal(false);
        setNewSubBrand({ name: "", brandId: "", discountPercent: "" });
        fetchSubBrands();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to create sub-brand");
      }
    } catch (error) {
      console.error("Error creating sub-brand:", error);
      alert("Failed to create sub-brand");
    }
  };

  const handleUpdateSubBrand = async () => {
    if (!editingSubBrand) return;

    try {
      const payload = {
        name: newSubBrand.name,
        discountPercent: newSubBrand.discountPercent ? parseFloat(newSubBrand.discountPercent) : null,
      };

      const response = await fetch(`/api/sub-brands/${editingSubBrand.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setShowAddModal(false);
        setEditingSubBrand(null);
        setNewSubBrand({ name: "", brandId: "", discountPercent: "" });
        fetchSubBrands();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update sub-brand");
      }
    } catch (error) {
      console.error("Error updating sub-brand:", error);
      alert("Failed to update sub-brand");
    }
  };

  // Filter sub-brands based on search query
  const filteredSubBrands = useMemo(() => {
    if (!searchQuery.trim()) return subBrands;

    const query = searchQuery.toLowerCase();
    return subBrands.filter(
      (subBrand) =>
        subBrand.name.toLowerCase().includes(query) ||
        (subBrand.brand?.name.toLowerCase().includes(query))
    );
  }, [searchQuery, subBrands]);

  // Paginate sub-brands
  const paginatedSubBrands = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredSubBrands.slice(startIndex, endIndex);
  }, [filteredSubBrands, currentPage]);

  const totalPages = Math.ceil(filteredSubBrands.length / itemsPerPage);

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleEditSubBrand = (subBrand: SubBrand) => {
    setEditingSubBrand(subBrand);
    setNewSubBrand({
      name: subBrand.name,
      brandId: subBrand.brandId,
      discountPercent: subBrand.discountPercent ? String(subBrand.discountPercent) : "",
    });
    setShowAddModal(true);
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">All Sub-brands</h1>

          {/* Search and Add Button */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search sub-brands..."
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
                  Found {filteredSubBrands.length} sub-brand
                  {filteredSubBrands.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-teal-500 hover:bg-teal-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Sub-brand
            </Button>
          </div>
        </div>

        {/* Sub-brands Table */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <Table aria-label="Sub-brands list">
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead scope="col" className="font-semibold">
                  Name
                </TableHead>
                <TableHead scope="col" className="font-semibold">
                  Parent Brand
                </TableHead>
                <TableHead scope="col" className="font-semibold text-center">
                  Discount %
                </TableHead>
                <TableHead scope="col" className="font-semibold">
                  Created Date
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
                    colSpan={5}
                    className="text-center text-gray-500 py-12"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading sub-brands...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-red-600 py-8"
                  >
                    <div className="space-y-2">
                      <p>Error: {error}</p>
                      <Button onClick={fetchAllData} variant="outline" size="sm">
                        Try Again
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedSubBrands.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-gray-500 py-8"
                  >
                    {searchQuery
                      ? "No sub-brands found matching your search"
                      : "No sub-brands yet. Click 'Add Sub-brand' to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedSubBrands.map((subBrand) => (
                  <TableRow key={subBrand.id}>
                    <TableCell className="font-medium">{subBrand.name}</TableCell>
                    <TableCell>{subBrand.brand?.name}</TableCell>
                    <TableCell className="text-center">
                      {subBrand.discountPercent !== null ? (
                        <span className="text-green-600 font-medium">{Number(subBrand.discountPercent)}%</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(subBrand.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            aria-label={`Actions for ${subBrand.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleEditSubBrand(subBrand)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Sub-brand
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
              {Math.min(currentPage * itemsPerPage, filteredSubBrands.length)} of{" "}
              {filteredSubBrands.length} sub-brands
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

        {/* Add/Edit Sub-brand Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{editingSubBrand ? "Edit Sub-brand" : "Add New Sub-brand"}</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingSubBrand(null);
                    setNewSubBrand({ name: "", brandId: "", discountPercent: "" });
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-gray-600 mb-4">
                {editingSubBrand ? "Update the sub-brand details below." : "Enter the details of the new sub-brand below."}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name <span className="text-red-500">*</span></label>
                  <Input
                    value={newSubBrand.name}
                    onChange={(e) =>
                      setNewSubBrand({ ...newSubBrand, name: e.target.value })
                    }
                    placeholder="Enter sub-brand name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Parent Brand <span className="text-red-500">*</span>
                  </label>
                  {editingSubBrand ? (
                    <div className="p-2 bg-gray-100 rounded border text-gray-700">
                      {editingSubBrand.brand?.name || "Unknown Brand"}
                    </div>
                  ) : (
                    <Select
                      value={newSubBrand.brandId || ""}
                      onValueChange={(value) =>
                        setNewSubBrand({ ...newSubBrand, brandId: value || "" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a parent brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {brands.map((brand) => (
                          <SelectItem key={brand.id} value={brand.id}>
                            {brand.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {editingSubBrand && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Discount Percentage (%)</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={newSubBrand.discountPercent}
                      onChange={(e) => setNewSubBrand({ ...newSubBrand, discountPercent: e.target.value })}
                      placeholder="e.g., 10"
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Current discount (read-only for reference)
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingSubBrand(null);
                    setNewSubBrand({ name: "", brandId: "", discountPercent: "" });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={editingSubBrand ? handleUpdateSubBrand : handleAddSubBrand}
                  className="bg-teal-500 hover:bg-teal-600"
                  disabled={!newSubBrand.name.trim() || (!editingSubBrand && !newSubBrand.brandId)}
                >
                  {editingSubBrand ? "Update Sub-brand" : "Save Sub-brand"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
