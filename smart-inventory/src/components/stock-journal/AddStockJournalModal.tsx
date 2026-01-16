"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Loader2 } from "lucide-react";
import useSWR from "swr";

interface Item {
  id: string;
  itemCode: string;
  name: string;
  unit: string;
  inventory?: {
    physicalStock: number | string;
    reservedQuantity: number | string;
  };
}

interface AddStockJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const ADJUSTMENT_TYPES = [
  { value: "INCREASE", label: "Increase Stock", description: "Add to physical stock" },
  { value: "DECREASE", label: "Decrease Stock", description: "Remove from physical stock" },
  { value: "RESERVED", label: "Reserve Stock", description: "Mark stock as reserved" },
  { value: "UNRESERVED", label: "Unreserve Stock", description: "Release reserved stock" },
];

export function AddStockJournalModal({
  isOpen,
  onClose,
  onSuccess,
}: AddStockJournalModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    itemId: "",
    date: new Date().toISOString().split("T")[0],
    adjustmentType: "",
    quantity: "",
    reason: "",
  });

  // Fetch items
  const { data: itemsData } = useSWR(isOpen ? "/api/items?limit=1000" : null);

  // Get selected item details
  const selectedItem = useMemo(() => {
    const items: Item[] = itemsData?.items || [];
    return items.find((item) => item.id === formData.itemId);
  }, [itemsData, formData.itemId]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        itemId: "",
        date: new Date().toISOString().split("T")[0],
        adjustmentType: "",
        quantity: "",
        reason: "",
      });
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/stock-journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: formData.itemId,
          date: formData.date,
          adjustmentType: formData.adjustmentType,
          quantity: parseFloat(formData.quantity),
          reason: formData.reason || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create stock journal");
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

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

  // Focus first input when modal opens
  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const physicalStock = Number(selectedItem?.inventory?.physicalStock || 0);
  const reservedQty = Number(selectedItem?.inventory?.reservedQuantity || 0);
  const availableStock = physicalStock - reservedQty;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Add Stock Journal</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Item Selection */}
          <div>
            <Label htmlFor="itemId">
              Item <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.itemId}
              onValueChange={(value) => handleSelectChange("itemId", value)}
            >
              <SelectTrigger id="itemId">
                <SelectValue placeholder="Select an item..." />
              </SelectTrigger>
              <SelectContent>
                {(itemsData?.items || []).map((item: Item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.itemCode} - {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stock Info */}
          {selectedItem && (
            <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Physical Stock</p>
                <p className="font-semibold">{physicalStock} {selectedItem.unit}</p>
              </div>
              <div>
                <p className="text-gray-500">Reserved</p>
                <p className="font-semibold">{reservedQty} {selectedItem.unit}</p>
              </div>
              <div>
                <p className="text-gray-500">Available</p>
                <p className="font-semibold text-teal-600">{availableStock} {selectedItem.unit}</p>
              </div>
            </div>
          )}

          {/* Date */}
          <div>
            <Label htmlFor="date">
              Date <span className="text-red-500">*</span>
            </Label>
            <Input
              id="date"
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
            />
          </div>

          {/* Adjustment Type */}
          <div>
            <Label htmlFor="adjustmentType">
              Adjustment Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.adjustmentType}
              onValueChange={(value) => handleSelectChange("adjustmentType", value)}
            >
              <SelectTrigger id="adjustmentType">
                <SelectValue placeholder="Select adjustment type..." />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div>
                      <span className="font-medium">{type.label}</span>
                      <span className="text-gray-500 ml-2 text-xs">({type.description})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div>
            <Label htmlFor="quantity">
              Quantity <span className="text-red-500">*</span>
            </Label>
            <Input
              id="quantity"
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              step="0.001"
              min="0.001"
              required
              placeholder="Enter quantity"
            />
            {selectedItem && (
              <p className="text-xs text-gray-500 mt-1">Unit: {selectedItem.unit}</p>
            )}
          </div>

          {/* Reason */}
          <div>
            <Label htmlFor="reason">Reason / Notes</Label>
            <Textarea
              id="reason"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              placeholder="Enter reason for adjustment (optional)"
              rows={3}
            />
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
              disabled={isSubmitting || !formData.itemId || !formData.adjustmentType || !formData.quantity}
              className="bg-teal-500 hover:bg-teal-600 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Journal"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
