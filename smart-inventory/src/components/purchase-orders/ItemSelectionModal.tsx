"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Search, Package } from "lucide-react";

interface Item {
  id: string;
  itemCode: string;
  name: string;
  unit: string;
  hsnCode: string | null;
  gstRate: number;
  purchasePrice: number;
  brandId?: string | null;
  subBrandId?: string | null;
  brand?: { id: string; name: string } | null;
  subBrand?: { id: string; name: string } | null;
}

interface ItemSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  selectedItemIds: string[];
  onSelect: (item: Item) => void;
}

export function ItemSelectionModal({
  isOpen,
  onClose,
  items,
  selectedItemIds,
  onSelect,
}: ItemSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [selectedSubBrandId, setSelectedSubBrandId] = useState("");

  // Filter available items (not already selected)
  const availableItems = useMemo(
    () => items.filter((item) => !selectedItemIds.includes(item.id)),
    [items, selectedItemIds]
  );

  // Unique brands derived from available items
  const uniqueBrands = useMemo(() => {
    const seen = new Set<string>();
    const brands: { id: string; name: string }[] = [];
    for (const item of availableItems) {
      if (item.brand && !seen.has(item.brand.id)) {
        seen.add(item.brand.id);
        brands.push(item.brand);
      }
    }
    return brands.sort((a, b) => a.name.localeCompare(b.name));
  }, [availableItems]);

  // Sub-brands filtered by selected brand
  const filteredSubBrands = useMemo(() => {
    const seen = new Set<string>();
    const subBrands: { id: string; name: string }[] = [];
    for (const item of availableItems) {
      if (selectedBrandId && item.brandId !== selectedBrandId) continue;
      if (item.subBrand && !seen.has(item.subBrand.id)) {
        seen.add(item.subBrand.id);
        subBrands.push(item.subBrand);
      }
    }
    return subBrands.sort((a, b) => a.name.localeCompare(b.name));
  }, [availableItems, selectedBrandId]);

  // Reset sub-brand when brand changes
  useEffect(() => {
    setSelectedSubBrandId("");
  }, [selectedBrandId]);

  // Filter items based on search + brand + sub-brand
  const filteredItems = useMemo(() => {
    let result = availableItems;

    if (selectedBrandId) {
      result = result.filter((item) => item.brandId === selectedBrandId);
    }
    if (selectedSubBrandId) {
      result = result.filter((item) => item.subBrandId === selectedSubBrandId);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.itemCode.toLowerCase().includes(query) ||
          item.hsnCode?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [availableItems, selectedBrandId, selectedSubBrandId, searchQuery]);

  // Handle item selection
  const handleSelectItem = (item: Item) => {
    onSelect(item);
    onClose();
    setSearchQuery("");
  };

  // Reset filters when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSelectedBrandId("");
      setSelectedSubBrandId("");
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Select Item</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by item name, code, or HSN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          {/* Brand / Sub-brand filters */}
          {uniqueBrands.length > 0 && (
            <div className="flex gap-3 mt-3">
              <select
                value={selectedBrandId}
                onChange={(e) => setSelectedBrandId(e.target.value)}
                className="flex-1 h-9 rounded-md border border-gray-200 px-3 text-sm bg-white"
              >
                <option value="">All Brands</option>
                {uniqueBrands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedSubBrandId}
                onChange={(e) => setSelectedSubBrandId(e.target.value)}
                disabled={filteredSubBrands.length === 0}
                className="flex-1 h-9 rounded-md border border-gray-200 px-3 text-sm bg-white disabled:opacity-50"
              >
                <option value="">All Sub-brands</option>
                {filteredSubBrands.map((sb) => (
                  <option key={sb.id} value={sb.id}>
                    {sb.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Summary */}
          <div className="mt-3 text-sm text-gray-600">
            Showing {filteredItems.length} of {availableItems.length} available
            items
          </div>
        </div>

        {/* Items Table */}
        <div className="flex-1 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              <Package className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">
                {searchQuery || selectedBrandId || selectedSubBrandId ? "No items found" : "No available items"}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {searchQuery || selectedBrandId || selectedSubBrandId
                  ? "Try adjusting your search or filters"
                  : "All items are already added to the order"}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    HSN
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    GST %
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Purchase Price
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">
                          {item.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {item.brand?.name}
                          {item.subBrand && ` › ${item.subBrand.name}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {item.itemCode}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {item.hsnCode || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {item.unit}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-600">
                      {Number(item.gstRate)}%
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                      {Number(item.purchasePrice) > 0
                        ? formatCurrency(Number(item.purchasePrice))
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex items-center justify-end gap-3 flex-shrink-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );

  // Use portal to render modal outside the current DOM hierarchy
  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : null;
}
