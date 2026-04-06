"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Search, Store } from "lucide-react";

interface Vendor {
  id: string;
  name: string;
  vendorNumber: string;
}

interface VendorSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendors: Vendor[];
  onSelect: (vendor: Vendor) => void;
  brandName?: string; // shown in the header for context
}

export function VendorSelectionModal({
  isOpen,
  onClose,
  vendors,
  onSelect,
  brandName,
}: VendorSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredVendors = useMemo(() => {
    if (!searchQuery) return vendors;
    const query = searchQuery.toLowerCase();
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(query) ||
        v.vendorNumber.toLowerCase().includes(query)
    );
  }, [vendors, searchQuery]);

  // Reset search when modal closes
  useEffect(() => {
    if (!isOpen) setSearchQuery("");
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleSelect = (vendor: Vendor) => {
    onSelect(vendor);
    onClose();
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex-shrink-0 rounded-t-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Select Vendor</h2>
              {brandName && (
                <p className="text-sm text-gray-500 mt-0.5">
                  Assigning vendor for <span className="font-medium text-gray-700">{brandName}</span>
                </p>
              )}
            </div>
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
              placeholder="Search by vendor name or number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          <div className="mt-3 text-sm text-gray-600">
            Showing {filteredVendors.length} of {vendors.length} vendors
          </div>
        </div>

        {/* Vendor List */}
        <div className="flex-1 overflow-y-auto">
          {filteredVendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              <Store className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">
                {searchQuery ? "No vendors found" : "No vendors available"}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {searchQuery
                  ? "Try adjusting your search"
                  : "Add vendors in the Masters section"}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendor Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendor No.
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredVendors.map((vendor) => (
                  <tr
                    key={vendor.id}
                    onClick={() => handleSelect(vendor)}
                    className="hover:bg-teal-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">
                        {vendor.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                      {vendor.vendorNumber}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex items-center justify-end flex-shrink-0 rounded-b-lg">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : null;
}
