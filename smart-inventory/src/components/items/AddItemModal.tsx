"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import useSWR from "swr";

interface Brand {
  id: string;
  name: string;
}

interface SubBrand {
  id: string;
  name: string;
  brandId: string;
}

interface EditItem {
  id: string;
  itemCode: string;
  name: string;
  description?: string;
  purchasePrice: string | number; // Cost price
  mrp: string | number; // Maximum Retail Price
  sellingPrice: string | number; // Actual selling price
  margin?: string | number;
  marginType?: string;
  userCode?: string;
  unit: string;
  hsnCode?: string;
  gstRate: string | number;
  brand?: { id: string; name: string };
  subBrand?: { id: string; name: string };
  inventory?: {
    minStockLevel: string | number;
  };
}

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editItem?: EditItem | null;
}

export function AddItemModal({
  isOpen,
  onClose,
  onSuccess,
  editItem,
}: AddItemModalProps) {
  const isEditing = !!editItem;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    userCode: "",
    description: "",
    brandId: "",
    subBrandId: "",
    hsnCode: "",
    gstRate: "18",
    purchasePrice: "0", // Cost price
    mrp: "0", // Maximum Retail Price
    sellingPrice: "0", // Actual selling price
    margin: "",
    marginType: "PERCENTAGE",
    minStock: "0",
    unit: "PCS",
  });

  // Use SWR to cache brands and sub-brands - NO N+1 queries!
  const { data: brandsData, isLoading: _brandsLoading } = useSWR(isOpen ? "/api/brands" : null);
  const { data: subBrandsData, isLoading: _subBrandsLoading } = useSWR(isOpen ? "/api/sub-brands" : null);

  // Ensure current brand is in the list (just like GST options are always there)
  const brands = useMemo(() => {
    const list = brandsData?.brands || [];
    if (editItem?.brand && !list.find((b: Brand) => b.id === editItem.brand?.id)) {
      return [{ id: editItem.brand.id, name: editItem.brand.name }, ...list];
    }
    return list;
  }, [brandsData, editItem]);

  // Reset form when opening for a new item — must NOT depend on brandsData/subBrandsData
  // or it will re-run (and wipe user input) every time SWR revalidates those queries.
  useEffect(() => {
    if (!editItem && isOpen) {
      setFormData({
        name: "",
        userCode: "",
        description: "",
        brandId: "",
        subBrandId: "",
        hsnCode: "",
        gstRate: "18",
        purchasePrice: "0",
        mrp: "0",
        sellingPrice: "0",
        margin: "",
        marginType: "PERCENTAGE",
        minStock: "0",
        unit: "PCS",
      });
    }
  }, [editItem, isOpen]);

  // Populate form when editing (wait for brands/sub-brands data to load first to avoid race condition)
  useEffect(() => {
    if (editItem && isOpen && brandsData && subBrandsData) {
      setFormData({
        name: editItem.name || "",
        userCode: editItem.userCode || "",
        description: editItem.description || "",
        brandId: editItem.brand?.id || "",
        subBrandId: editItem.subBrand?.id || "",
        hsnCode: editItem.hsnCode || "",
        gstRate: editItem.gstRate !== undefined && editItem.gstRate !== null ? String(editItem.gstRate) : "18",
        purchasePrice: editItem.purchasePrice !== undefined && editItem.purchasePrice !== null ? String(editItem.purchasePrice) : "0",
        mrp: editItem.mrp !== undefined && editItem.mrp !== null ? String(editItem.mrp) : "0",
        sellingPrice: editItem.sellingPrice !== undefined && editItem.sellingPrice !== null ? String(editItem.sellingPrice) : "0",
        margin: editItem.margin !== undefined && editItem.margin !== null ? String(editItem.margin) : "",
        marginType: editItem.marginType || "PERCENTAGE",
        minStock: String(editItem.inventory?.minStockLevel ?? 0),
        unit: editItem.unit || "PCS",
      });
    }
  }, [editItem, isOpen, brandsData, subBrandsData]);

  // Filter sub-brands based on selected brand (ensure current sub-brand is in the list)
  const filteredSubBrands = useMemo(() => {
    const subBrands = subBrandsData?.subBrands || [];
    if (!formData.brandId) return [];

    let filtered = subBrands.filter((sb: SubBrand) => sb.brandId === formData.brandId);

    // Ensure current sub-brand is in the list (just like GST options are always there)
    if (editItem?.subBrand && !filtered.find((sb: SubBrand) => sb.id === editItem.subBrand?.id)) {
      filtered = [{ id: editItem.subBrand.id, name: editItem.subBrand.name, brandId: formData.brandId }, ...filtered];
    }

    return filtered;
  }, [formData.brandId, subBrandsData, editItem]);

  // Reset sub-brand when brand changes (but only if sub-brands data is loaded)
  // This prevents resetting subBrandId during initial form population when editing
  useEffect(() => {
    // Only run this check if subBrandsData is loaded and there's an actual brand change
    if (subBrandsData && formData.brandId && formData.subBrandId) {
      const isValid = filteredSubBrands.find((sb: SubBrand) => sb.id === formData.subBrandId);
      if (!isValid) {
        setFormData(prev => ({ ...prev, subBrandId: "" }));
      }
    }
  }, [formData.brandId, formData.subBrandId, filteredSubBrands, subBrandsData]);

  // Auto-calculate selling price from purchase price + margin
  useEffect(() => {
    const marginVal = parseFloat(formData.margin);
    const purchaseVal = parseFloat(formData.purchasePrice);
    if (!isNaN(marginVal) && marginVal > 0 && !isNaN(purchaseVal)) {
      let calculatedPrice: number;
      if (formData.marginType === "PERCENTAGE") {
        calculatedPrice = purchaseVal + (purchaseVal * marginVal / 100);
      } else {
        calculatedPrice = purchaseVal + marginVal;
      }
      setFormData(prev => ({
        ...prev,
        sellingPrice: (Math.round(calculatedPrice * 100) / 100).toString(),
      }));
    }
  }, [formData.purchasePrice, formData.margin, formData.marginType]);

  const hasMargin = formData.margin !== "" && parseFloat(formData.margin) > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation for required fields
    const missing: string[] = [];
    if (!formData.name.trim()) missing.push("Item Name");
    if (!formData.brandId) missing.push("Brand");
    if (!formData.subBrandId) missing.push("Sub-brand");

    if (missing.length > 0) {
      setError(`Required fields missing: ${missing.join(", ")}`);
      return;
    }

    setIsSubmitting(true);

    try {
      const url = isEditing ? `/api/items/${editItem.id}` : "/api/items";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          userCode: formData.userCode || null,
          description: formData.description || null,
          brandId: formData.brandId,
          subBrandId: formData.subBrandId,
          hsnCode: formData.hsnCode || null,
          gstRate: parseFloat(formData.gstRate) || 0,
          purchasePrice: parseFloat(formData.purchasePrice) || 0,
          mrp: parseFloat(formData.mrp) || 0,
          sellingPrice: parseFloat(formData.sellingPrice) || 0,
          margin: formData.margin !== "" ? parseFloat(formData.margin) : null,
          marginType: formData.marginType,
          minStock: parseFloat(formData.minStock) || 0,
          unit: formData.unit,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${isEditing ? "update" : "create"} item`);
      }

      // Success
      onSuccess?.();
      onClose();

      // Reset form
      setFormData({
        name: "",
        userCode: "",
        description: "",
        brandId: "",
        subBrandId: "",
        hsnCode: "",
        gstRate: "18",
        purchasePrice: "0",
        mrp: "0",
        sellingPrice: "0",
        margin: "",
        marginType: "PERCENTAGE",
        minStock: "0",
        unit: "PCS",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Focus first input when modal opens
  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{isEditing ? "Edit Item" : "Add New Item"}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label
                  htmlFor="item-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Item Name <span className="text-red-500">*</span>
                </label>
                <Input
                  id="item-name"
                  ref={firstInputRef}
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Enter item name"
                />
              </div>
              <div>
                <label
                  htmlFor="item-usercode"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Item Code
                </label>
                <Input
                  id="item-usercode"
                  type="text"
                  name="userCode"
                  value={formData.userCode}
                  onChange={handleChange}
                  placeholder="Enter your item code"
                />
                <p className="text-xs text-gray-500 mt-1">Your own code for searching</p>
              </div>
              <div className="md:col-span-2">
                <label
                  htmlFor="item-description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description
                </label>
                <Input
                  id="item-description"
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter item description (optional)"
                />
              </div>
            </div>
          </div>

          {/* Brand & Category */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Brand & Category
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Brand <span className="text-red-500">*</span>
                </label>
                <Select
                  key={`brand-${formData.brandId}-${brands.length}`}
                  value={formData.brandId}
                  onValueChange={(value) => handleSelectChange("brandId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((brand: Brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sub-brand <span className="text-red-500">*</span>
                </label>
                <Select
                  key={`subbrand-${formData.subBrandId}-${filteredSubBrands.length}`}
                  value={formData.subBrandId}
                  onValueChange={(value) => handleSelectChange("subBrandId", value)}
                  disabled={!formData.brandId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.brandId ? "Select a sub-brand" : "Select brand first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSubBrands.map((subBrand: SubBrand) => (
                      <SelectItem key={subBrand.id} value={subBrand.id}>
                        {subBrand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Tax & HSN */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Tax Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="item-hsn"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  HSN/SAC Code
                </label>
                <Input
                  id="item-hsn"
                  type="text"
                  name="hsnCode"
                  value={formData.hsnCode}
                  onChange={handleChange}
                  maxLength={8}
                  placeholder="e.g., 1234"
                />
                <p className="text-xs text-gray-500 mt-1">Up to 8 characters</p>
              </div>
              <div>
                <label
                  htmlFor="item-gst"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  GST Rate (%) <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.gstRate}
                  onValueChange={(value) => handleSelectChange("gstRate", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0%</SelectItem>
                    <SelectItem value="5">5%</SelectItem>
                    <SelectItem value="12">12%</SelectItem>
                    <SelectItem value="18">18%</SelectItem>
                    <SelectItem value="28">28%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Pricing
            </h3>
            <div className="space-y-4">
              {/* Row 1: Purchase Price */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="item-purchase-price"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Purchase Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="item-purchase-price"
                    type="number"
                    name="purchasePrice"
                    value={formData.purchasePrice}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">Cost price (what you pay)</p>
                </div>
              </div>

              {/* Row 2: Margin + Selling Price */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="item-margin"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Margin
                  </label>
                  <div className="flex gap-1">
                    <Input
                      id="item-margin"
                      type="number"
                      name="margin"
                      value={formData.margin}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="flex-1"
                    />
                    <div className="flex rounded-md border border-gray-300 overflow-hidden shrink-0">
                      <button
                        type="button"
                        className={`px-2.5 py-1.5 text-sm font-medium transition-colors ${
                          formData.marginType === "PERCENTAGE"
                            ? "bg-teal-500 text-white"
                            : "bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                        onClick={() => handleSelectChange("marginType", "PERCENTAGE")}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        className={`px-2.5 py-1.5 text-sm font-medium border-l border-gray-300 transition-colors ${
                          formData.marginType === "AMOUNT"
                            ? "bg-teal-500 text-white"
                            : "bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                        onClick={() => handleSelectChange("marginType", "AMOUNT")}
                      >
                        ₹
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.marginType === "PERCENTAGE" ? "Percentage markup on purchase price" : "Fixed amount added to purchase price"}
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="item-selling-price"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Selling Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="item-selling-price"
                    type="number"
                    name="sellingPrice"
                    value={formData.sellingPrice}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    disabled={hasMargin}
                    className={hasMargin ? "bg-gray-100" : ""}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {hasMargin ? "Auto-calculated from margin" : "Actual price you sell at"}
                  </p>
                </div>
              </div>

              {/* Row 3: MRP */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="item-mrp"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    MRP (₹) <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="item-mrp"
                    type="number"
                    name="mrp"
                    value={formData.mrp}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum Retail Price</p>
                </div>
              </div>
            </div>
          </div>

          {/* Inventory */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Inventory
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="item-unit"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Unit of Measurement <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => handleSelectChange("unit", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PCS">PCS (Pieces)</SelectItem>
                    <SelectItem value="KG">KG (Kilograms)</SelectItem>
                    <SelectItem value="LTR">LTR (Liters)</SelectItem>
                    <SelectItem value="MTR">MTR (Meters)</SelectItem>
                    <SelectItem value="BOX">BOX (Boxes)</SelectItem>
                    <SelectItem value="SET">SET (Sets)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label
                  htmlFor="item-min-stock"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Minimum Stock Level
                </label>
                <Input
                  id="item-min-stock"
                  type="number"
                  name="minStock"
                  value={formData.minStock}
                  onChange={handleChange}
                  step="0.001"
                  min="0"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-teal-500 hover:bg-teal-600 text-white"
            >
              {isSubmitting ? (isEditing ? "Updating..." : "Creating...") : (isEditing ? "Update Item" : "Create Item")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}