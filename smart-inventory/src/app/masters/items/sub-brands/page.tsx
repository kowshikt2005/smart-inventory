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
import { Plus, MoreHorizontal, Edit, Loader2, X, Camera, Upload } from "lucide-react";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";

interface Brand {
  id: string;
  name: string;
}

interface SubBrand {
  id: string;
  name: string;
  brandId: string;
  discountPercent: number | null;
  logoUrl: string | null;
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
  const [newSubBrand, setNewSubBrand] = useState({ name: "", brandId: "", discountPercent: "", logoUrl: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsPerPage = 10;

  const fetchAllData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Fetch brands and all sub-brands in parallel — single request each
      const [brandsRes, subBrandsRes] = await Promise.all([
        fetch("/api/brands"),
        fetch("/api/sub-brands"),
      ]);
      if (!brandsRes.ok) throw new Error("Failed to fetch brands");
      if (!subBrandsRes.ok) throw new Error("Failed to fetch sub-brands");

      const brandsData = await brandsRes.json();
      const subBrandsData = await subBrandsRes.json();

      const brandsArr: Brand[] = brandsData.brands || [];
      const brandMap = new Map(brandsArr.map((b: Brand) => [b.id, b.name]));

      const subBrandsWithBrand = (subBrandsData.subBrands || []).map((sb: SubBrand) => ({
        ...sb,
        brand: { name: brandMap.get(sb.brandId) || "" },
      }));

      setBrands(brandsArr);
      setSubBrands(subBrandsWithBrand);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("Error fetching data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch data from API
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "brands");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setNewSubBrand((prev) => ({ ...prev, logoUrl: data.url }));
      } else {
        const data = await response.json();
        setModalError(data.error || "Failed to upload logo");
      }
    } catch (err) {
      console.error("Error uploading logo:", err);
      setModalError("Failed to upload logo");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddSubBrand = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      const payload = {
        name: newSubBrand.name,
        discountPercent: newSubBrand.discountPercent ? parseFloat(newSubBrand.discountPercent) : null,
        logoUrl: newSubBrand.logoUrl || null,
      };

      const response = await fetch(`/api/brands/${newSubBrand.brandId}/sub-brands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setShowAddModal(false);
        setNewSubBrand({ name: "", brandId: "", discountPercent: "", logoUrl: "" });
        setModalError(null);
        fetchAllData();
      } else {
        const data = await response.json();
        setModalError(data.error || "Failed to create sub-brand");
      }
    } catch (error) {
      console.error("Error creating sub-brand:", error);
      setModalError("Failed to create sub-brand");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSubBrand = async () => {
    if (!editingSubBrand || isSubmitting) return;
    setIsSubmitting(true);
    setModalError(null);

    try {
      const payload = {
        name: newSubBrand.name,
        discountPercent: newSubBrand.discountPercent ? parseFloat(newSubBrand.discountPercent) : null,
        logoUrl: newSubBrand.logoUrl || null,
      };

      const response = await fetch(`/api/sub-brands/${editingSubBrand.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setShowAddModal(false);
        setEditingSubBrand(null);
        setNewSubBrand({ name: "", brandId: "", discountPercent: "", logoUrl: "" });
        setModalError(null);
        fetchAllData();
      } else {
        const data = await response.json();
        setModalError(data.error || "Failed to update sub-brand");
      }
    } catch (error) {
      console.error("Error updating sub-brand:", error);
      setModalError("Failed to update sub-brand");
    } finally {
      setIsSubmitting(false);
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
      logoUrl: subBrand.logoUrl || "",
    });
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingSubBrand(null);
    setNewSubBrand({ name: "", brandId: "", discountPercent: "", logoUrl: "" });
    setModalError(null);
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
              onClick={() => { setShowAddModal(true); setModalError(null); }}
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
                <TableHead scope="col" className="font-semibold w-16">
                  Logo
                </TableHead>
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
                    colSpan={6}
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
                    colSpan={6}
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
                    colSpan={6}
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
                    <TableCell>
                      {subBrand.logoUrl ? (
                        <img
                          src={subBrand.logoUrl}
                          alt={`${subBrand.name} logo`}
                          className="w-8 h-8 rounded object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                          <Camera className="h-4 w-4 text-gray-400" />
                        </div>
                      )}
                    </TableCell>
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
                <Button variant="ghost" size="sm" onClick={closeModal}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-gray-600 mb-4">
                {editingSubBrand ? "Update the sub-brand details below." : "Enter the details of the new sub-brand below."}
              </p>

              {modalError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-4">
                  {modalError}
                </div>
              )}

              <div className="space-y-4">
                {/* Logo Upload */}
                <div>
                  <label className="block text-sm font-medium mb-1">Logo</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  {newSubBrand.logoUrl ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={newSubBrand.logoUrl}
                        alt="Sub-brand logo preview"
                        className="w-16 h-16 rounded object-cover border"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                        >
                          Change
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setNewSubBrand((prev) => ({ ...prev, logoUrl: "" }))}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center gap-2 hover:border-teal-400 hover:bg-teal-50/50 transition-colors cursor-pointer"
                    >
                      {isUploading ? (
                        <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
                      ) : (
                        <Upload className="h-6 w-6 text-gray-400" />
                      )}
                      <span className="text-sm text-gray-500">
                        {isUploading ? "Uploading..." : "Click to upload logo"}
                      </span>
                    </button>
                  )}
                </div>

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
                <Button variant="outline" onClick={closeModal}>
                  Cancel
                </Button>
                <Button
                  onClick={editingSubBrand ? handleUpdateSubBrand : handleAddSubBrand}
                  className="bg-teal-500 hover:bg-teal-600"
                  disabled={!newSubBrand.name.trim() || (!editingSubBrand && !newSubBrand.brandId) || isSubmitting || isUploading}
                >
                  {isSubmitting ? (editingSubBrand ? "Updating..." : "Saving...") : (editingSubBrand ? "Update Sub-brand" : "Save Sub-brand")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
