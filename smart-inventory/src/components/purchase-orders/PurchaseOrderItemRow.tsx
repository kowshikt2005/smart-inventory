"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Package } from "lucide-react";
import { useMemo, useState } from "react";
import { ItemSelectionModal } from "./ItemSelectionModal";

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

interface OrderItemData {
  id: string;
  itemId: string;
  quantity: number;
  rate: number;
  taxRate: number;
  taxAmount: number;
  amount: number;
}

interface PurchaseOrderItemRowProps {
  item: OrderItemData;
  items: Item[];
  selectedItemIds: string[];
  onUpdate: (updatedItem: OrderItemData) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function PurchaseOrderItemRow({
  item,
  items,
  selectedItemIds,
  onUpdate,
  onRemove,
  disabled = false,
}: PurchaseOrderItemRowProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get selected item details
  const selectedItem = useMemo(
    () => items.find((i) => i.id === item.itemId),
    [items, item.itemId]
  );

  // Handle item selection from modal
  const handleItemSelect = (selectedItemData: Item) => {
    const rate = Number(selectedItemData.purchasePrice) || 0;
    const taxRate = Number(selectedItemData.gstRate) || 0;
    const quantity = item.quantity || 1;
    const baseAmount = quantity * rate;
    const taxAmount = baseAmount * (taxRate / 100);

    onUpdate({
      ...item,
      itemId: selectedItemData.id,
      rate,
      taxRate,
      quantity,
      amount: Math.round(baseAmount * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
    });
  };

  // Handle quantity change
  const handleQuantityChange = (value: string) => {
    const quantity = parseFloat(value) || 0;
    const baseAmount = quantity * item.rate;
    const taxAmount = baseAmount * (item.taxRate / 100);

    onUpdate({
      ...item,
      quantity,
      amount: Math.round(baseAmount * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
    });
  };

  // Handle rate change
  const handleRateChange = (value: string) => {
    const rate = parseFloat(value) || 0;
    const baseAmount = item.quantity * rate;
    const taxAmount = baseAmount * (item.taxRate / 100);

    onUpdate({
      ...item,
      rate,
      amount: Math.round(baseAmount * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
    });
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <>
      <tr>
        {/* Item Selection */}
        <td className="px-3 py-2">
          {selectedItem ? (
            <div className="min-w-[200px]">
              <div className="flex flex-col">
                <span className="font-medium text-sm">{selectedItem.name}</span>
                <span className="text-xs text-gray-500">
                  {selectedItem.itemCode}
                  {selectedItem.hsnCode && ` | HSN: ${selectedItem.hsnCode}`}
                </span>
              </div>
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsModalOpen(true)}
                  className="mt-1 h-7 text-xs text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-2"
                >
                  <Package className="h-3 w-3 mr-1" />
                  Change Item
                </Button>
              )}
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(true)}
              disabled={disabled}
              className="w-full min-w-[200px] justify-start text-left font-normal"
            >
              <Package className="h-4 w-4 mr-2" />
              Select item...
            </Button>
          )}
        </td>

        {/* HSN Code */}
        <td className="px-3 py-2 text-sm text-gray-600">
          {selectedItem?.hsnCode || "-"}
        </td>

        {/* Quantity */}
        <td className="px-3 py-2">
          <Input
            type="number"
            min="1"
            step="1"
            value={item.quantity || ""}
            onChange={(e) => handleQuantityChange(e.target.value)}
            className="w-24 text-right"
            disabled={disabled || !item.itemId}
          />
        </td>

        {/* Unit */}
        <td className="px-3 py-2 text-sm text-gray-600">
          {selectedItem?.unit || "-"}
        </td>

        {/* Rate */}
        <td className="px-3 py-2">
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={item.rate || ""}
            onChange={(e) => handleRateChange(e.target.value)}
            className="w-28 text-right"
            disabled={disabled || !item.itemId}
          />
        </td>

        {/* Tax Rate */}
        <td className="px-3 py-2 text-sm text-gray-600 text-right">
          {item.taxRate}%
        </td>

        {/* Tax Amount */}
        <td className="px-3 py-2 text-sm text-gray-600 text-right">
          {formatCurrency(item.taxAmount)}
        </td>

        {/* Total (base amount + tax amount) */}
        <td className="px-3 py-2 text-sm font-medium text-right">
          {formatCurrency(item.amount + item.taxAmount)}
        </td>

        {/* Actions */}
        <td className="px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={disabled}
            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </td>
      </tr>

      {/* Item Selection Modal */}
      {isModalOpen && (
        <ItemSelectionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          items={items}
          selectedItemIds={selectedItemIds}
          onSelect={handleItemSelect}
        />
      )}
    </>
  );
}
