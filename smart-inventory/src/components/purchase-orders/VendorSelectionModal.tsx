"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { X, Search, Store } from "lucide-react";

interface Vendor {
  id: string;
  vendorNumber: string;
  name: string;
  gstin: string | null;
  creditDays: number;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

interface VendorSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendors: Vendor[];
  onSelect: (vendor: Vendor) => void;
}

export function VendorSelectionModal({
  isOpen,
  onClose,
  vendors,
  onSelect,
}: VendorSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredVendors = useMemo(() => {
    if (!searchQuery.trim()) return vendors;
    const query = searchQuery.toLowerCase();
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(query) ||
        v.vendorNumber.toLowerCase().includes(query) ||
        v.gstin?.toLowerCase().includes(query) ||
        v.city?.toLowerCase().includes(query)
    );
  }, [vendors, searchQuery]);

  const handleSelect = (vendor: Vendor) => {
    onSelect(vendor);
    onClose();
    setSearchQuery("");
  };

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

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

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Select Vendor</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by name, vendor number, GSTIN, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
        </div>

        {/* Vendor list */}
        <div className="overflow-y-auto flex-1">
          {filteredVendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Store className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No vendors found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase text-xs tracking-wider">
                    Vendor
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase text-xs tracking-wider">
                    Number
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase text-xs tracking-wider">
                    GSTIN
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase text-xs tracking-wider">
                    City
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredVendors.map((vendor) => (
                  <tr
                    key={vendor.id}
                    onClick={() => handleSelect(vendor)}
                    className="hover:bg-teal-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {vendor.name}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {vendor.vendorNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {vendor.gstin || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {vendor.city || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-3 flex-shrink-0">
          <p className="text-xs text-gray-400">
            {filteredVendors.length} vendor{filteredVendors.length !== 1 ? "s" : ""} shown
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
