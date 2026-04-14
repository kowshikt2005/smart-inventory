"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Search, Users } from "lucide-react";

export interface PartyItem {
  id: string;
  primaryText: string;
  secondaryText?: string;
}

interface PartySelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: PartyItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function PartySelectionModal({
  isOpen,
  onClose,
  title,
  items,
  selectedId,
  onSelect,
}: PartySelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.primaryText.toLowerCase().includes(q) ||
        item.secondaryText?.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  // Reset search when modal opens/closes
  useEffect(() => {
    if (!isOpen) setSearchQuery("");
  }, [isOpen]);

  // Escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[80vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-5 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          <p className="mt-2 text-xs text-gray-500">
            {filteredItems.length} of {items.length} shown
          </p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No results found</p>
              <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
            </div>
          ) : (
            <ul>
              {filteredItems.map((item) => {
                const isSelected = item.id === selectedId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(item.id);
                        onClose();
                      }}
                      className={`w-full text-left px-5 py-3.5 flex items-center justify-between transition-colors border-b border-gray-100 last:border-0 ${
                        isSelected
                          ? "bg-blue-50 text-blue-700"
                          : "hover:bg-gray-50 text-gray-900"
                      }`}
                    >
                      <span className="font-medium text-sm">{item.primaryText}</span>
                      {item.secondaryText && (
                        <span className={`text-xs ml-3 flex-shrink-0 ${isSelected ? "text-blue-500" : "text-gray-400"}`}>
                          {item.secondaryText}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex justify-end flex-shrink-0">
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
