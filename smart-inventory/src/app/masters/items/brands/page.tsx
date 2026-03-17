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
import { Plus, MoreHorizontal, Edit, Loader2, X, Camera, Upload } from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";

interface Vendor {
  id: string;
  name: string;
  vendorNumber: string;
}

interface Brand {
  id: string;
  name: string;
  discountPercent: number | null;
  logoUrl: string | null;
  preferredVendorId: string | null;
  preferredVendor: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface BrandForm {
  name: string;
  discountPercent: string;
  logoUrl: string;
  preferredVendorId: string;
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorSearch, setVendorSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [newBrand, setNewBrand] = useState<BrandForm>({ name: "", discountPercent: "", logoUrl: "", preferredVendorId: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchBrands();
    fetchVendors();
  }, []);

  const fetchBrands = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/brands");
      if (!response.ok) throw new Error("Failed to fetch brands");
      const data = await response.json();
      setBrands(data.brands || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await fetch("/api/vendors?activeOnly=true&limit=500");
      if (!response.ok) return;
      const data = await response.json();
      setVendors(data.vendors || []);
    } catch {
      // non-critical, vendor list just won't show
    }
  };

  const filteredVendors = useMemo(() => {
    if (!vendorSearch.trim()) return vendors;
    const q = vendorSearch.toLowerCase();
    return vendors.filter((v) => v.name.toLowerCase().includes(q));
  }, [vendors, vendorSearch]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "brands");
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      if (response.ok) {
        const data = await response.json();
        setNewBrand((prev) => ({ ...prev, logoUrl: data.url }));
      } else {
        const data = await response.json();
        setModalError(data.error || "Failed to upload logo");
      }
    } catch {
      setModalError("Failed to upload logo");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddBrand = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      const payload = {
        name: newBrand.name,
        discountPercent: newBrand.discountPercent ? parseFloat(newBrand.discountPercent) : null,
        logoUrl: newBrand.logoUrl || null,
        preferredVendorId: newBrand.preferredVendorId || null,
      };
      const response = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        setShowAddModal(false);
        setNewBrand({ name: "", discountPercent: "", logoUrl: "", preferredVendorId: "" });
        fetchBrands();
      } else {
        const data = await response.json();
        setModalError(data.error || "Failed to create brand");
      }
    } catch {
      setModalError("Failed to create brand");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateBrand = async () => {
    if (!editingBrand || isSubmitting) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      const payload = {
        name: newBrand.name,
        discountPercent: newBrand.discountPercent ? parseFloat(newBrand.discountPercent) : null,
        logoUrl: newBrand.logoUrl || null,
        preferredVendorId: newBrand.preferredVendorId || null,
      };
      const response = await fetch(`/api/brands/${editingBrand.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        setShowAddModal(false);
        setEditingBrand(null);
        setNewBrand({ name: "", discountPercent: "", logoUrl: "", preferredVendorId: "" });
        fetchBrands();
      } else {
        const data = await response.json();
        setModalError(data.error || "Failed to update brand");
      }
    } catch {
      setModalError("Failed to update brand");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return brands;
    const query = searchQuery.toLowerCase();
    return brands.filter((brand) => brand.name.toLowerCase().includes(query));
  }, [searchQuery, brands]);

  const paginatedBrands = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredBrands.slice(start, start + itemsPerPage);
  }, [filteredBrands, currentPage]);

  const totalPages = Math.ceil(filteredBrands.length / itemsPerPage);

  const handleEditBrand = (brand: Brand) => {
    setEditingBrand(brand);
    setNewBrand({
      name: brand.name,
      discountPercent: brand.discountPercent ? String(brand.discountPercent) : "",
      logoUrl: brand.logoUrl || "",
      preferredVendorId: brand.preferredVendorId || "",
    });
    setVendorSearch("");
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingBrand(null);
    setNewBrand({ name: "", discountPercent: "", logoUrl: "", preferredVendorId: "" });
    setVendorSearch("");
    setModalError(null);
  };

  const selectedVendorName = useMemo(() => {
    if (!newBrand.preferredVendorId) return "";
    return vendors.find((v) => v.id === newBrand.preferredVendorId)?.name || "";
  }, [newBrand.preferredVendorId, vendors]);

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">All Brands</h1>
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search brands..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="pr-8"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <Button onClick={() => { setShowAddModal(true); setModalError(null); }} className="bg-teal-500 hover:bg-teal-600 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Brand
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <Table aria-label="Brands list">
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold w-16">Logo</TableHead>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold text-center">Discount %</TableHead>
                <TableHead className="font-semibold">Preferred Vendor</TableHead>
                <TableHead className="font-semibold">Created Date</TableHead>
                <TableHead className="font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-12">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading brands...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-red-600 py-8">
                    <div className="space-y-2">
                      <p>Error: {error}</p>
                      <Button onClick={fetchBrands} variant="outline" size="sm">Try Again</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedBrands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    {searchQuery ? "No brands found matching your search" : "No brands yet. Click 'Add Brand' to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedBrands.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell>
                      {brand.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={brand.logoUrl} alt={`${brand.name} logo`} className="w-8 h-8 rounded object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                          <Camera className="h-4 w-4 text-gray-400" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{brand.name}</TableCell>
                    <TableCell className="text-center">
                      {brand.discountPercent !== null ? (
                        <span className="text-green-600 font-medium">{Number(brand.discountPercent)}%</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {brand.preferredVendor ? (
                        <span className="text-sm text-gray-800">{brand.preferredVendor.name}</span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>{new Date(brand.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0" aria-label={`Actions for ${brand.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditBrand(brand)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Brand
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

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredBrands.length)} of {filteredBrands.length} brands
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
              <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
            </div>
          </div>
        )}

        {/* Add/Edit Brand Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{editingBrand ? "Edit Brand" : "Add New Brand"}</h2>
                <Button variant="ghost" size="sm" onClick={closeModal}><X className="h-4 w-4" /></Button>
              </div>

              {modalError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-4">
                  {modalError}
                </div>
              )}

              <div className="space-y-4">
                {/* Logo Upload */}
                <div>
                  <label className="block text-sm font-medium mb-1">Logo</label>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  {newBrand.logoUrl ? (
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={newBrand.logoUrl} alt="Brand logo preview" className="w-16 h-16 rounded object-cover border" />
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>Change</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setNewBrand((p) => ({ ...p, logoUrl: "" }))} className="text-red-600 hover:text-red-700">Remove</Button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center gap-2 hover:border-teal-400 hover:bg-teal-50/50 transition-colors cursor-pointer">
                      {isUploading ? <Loader2 className="h-6 w-6 text-gray-400 animate-spin" /> : <Upload className="h-6 w-6 text-gray-400" />}
                      <span className="text-sm text-gray-500">{isUploading ? "Uploading..." : "Click to upload logo"}</span>
                    </button>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium mb-1">Name <span className="text-red-500">*</span></label>
                  <Input value={newBrand.name} onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value })} placeholder="Enter brand name" />
                </div>

                {/* Preferred Vendor */}
                <div>
                  <label className="block text-sm font-medium mb-1">Preferred Vendor</label>
                  <p className="text-xs text-gray-500 mb-2">Used for auto-creating purchase orders during stock reorders</p>
                  {newBrand.preferredVendorId ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-800">
                        {selectedVendorName}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => { setNewBrand((p) => ({ ...p, preferredVendorId: "" })); setVendorSearch(""); }}
                        className="text-red-600 hover:text-red-700 shrink-0"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Clear
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Input
                        placeholder="Search vendor..."
                        value={vendorSearch}
                        onChange={(e) => setVendorSearch(e.target.value)}
                      />
                      {vendorSearch && filteredVendors.length > 0 && (
                        <div className="border border-gray-200 rounded-md shadow-sm max-h-40 overflow-y-auto bg-white">
                          {filteredVendors.slice(0, 8).map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50 hover:text-teal-700 transition-colors"
                              onClick={() => { setNewBrand((p) => ({ ...p, preferredVendorId: v.id })); setVendorSearch(""); }}
                            >
                              <span className="font-medium">{v.name}</span>
                              <span className="text-gray-400 ml-2 text-xs">{v.vendorNumber}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {vendorSearch && filteredVendors.length === 0 && (
                        <p className="text-sm text-gray-500 px-1">No vendors found</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={closeModal}>Cancel</Button>
                <Button
                  onClick={editingBrand ? handleUpdateBrand : handleAddBrand}
                  className="bg-teal-500 hover:bg-teal-600"
                  disabled={!newBrand.name.trim() || isSubmitting || isUploading}
                >
                  {isSubmitting ? (editingBrand ? "Updating..." : "Saving...") : (editingBrand ? "Update Brand" : "Save Brand")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
