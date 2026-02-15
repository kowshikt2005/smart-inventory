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

  // Filter available items (not already selected)
  const availableItems = useMemo(
    () => items.filter((item) => !selectedItemIds.includes(item.id)),
    [items, selectedItemIds]
  );

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery) return availableItems;

    const query = searchQuery.toLowerCase();
    return availableItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.itemCode.toLowerCase().includes(query) ||
        item.hsnCode?.toLowerCase().includes(query)
    );
  }, [availableItems, searchQuery]);

  // Handle item selection
  const handleSelectItem = (item: Item) => {
    onSelect(item);
    onClose();
    setSearchQuery("");
  };

  // Reset search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
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
                {searchQuery ? "No items found" : "No available items"}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {searchQuery
                  ? "Try adjusting your search terms"
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
                      <span className="font-medium text-gray-900">
                        {item.name}
                      </span>
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
