"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { X, Search, User } from "lucide-react";

interface Customer {
  id: string;
  customerNumber: string;
  name: string;
  gstin: string | null;
  creditDays: number;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

interface CustomerSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  onSelect: (customer: Customer) => void;
}

export function CustomerSelectionModal({
  isOpen,
  onClose,
  customers,
  onSelect,
}: CustomerSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const query = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.customerNumber.toLowerCase().includes(query) ||
        c.gstin?.toLowerCase().includes(query) ||
        c.city?.toLowerCase().includes(query)
    );
  }, [customers, searchQuery]);

  const handleSelect = (customer: Customer) => {
    onSelect(customer);
    onClose();
    setSearchQuery("");
  };

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Escape key handler
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
            <h2 className="text-xl font-bold text-gray-900">Select Customer</h2>
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
              placeholder="Search by name, customer number, GSTIN, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
        </div>

        {/* Customer list */}
        <div className="overflow-y-auto flex-1">
          {filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <User className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No customers found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase text-xs tracking-wider">
                    Customer
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
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => handleSelect(customer)}
                    className="hover:bg-teal-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {customer.name}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {customer.customerNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {customer.gstin || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {customer.city || "-"}
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
            {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? "s" : ""} shown
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
