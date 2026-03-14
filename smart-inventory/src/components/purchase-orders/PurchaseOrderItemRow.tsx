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
  uomConversions?: Array<{ name: string; factor: number }> | null;
}

interface OrderItemData {
  id: string;
  itemId: string;
  itemName?: string | null;
  quantity: number;
  unit?: string;
  uomFactor?: number;
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
  sno?: number;
}

export function PurchaseOrderItemRow({
  item,
  items,
  selectedItemIds,
  onUpdate,
  onRemove,
  disabled = false,
  sno,
}: PurchaseOrderItemRowProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get selected item details
  const selectedItem = useMemo(
    () => items.find((i) => i.id === item.itemId),
    [items, item.itemId]
  );

  // Fallback display name for imported items with no catalog link
  const displayName = selectedItem?.name || item.itemName || null;

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
      unit: selectedItemData.unit,
      uomFactor: 1,
      rate,
      taxRate,
      quantity,
      amount: Math.round(baseAmount * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
    });
  };

  const handleUnitChange = (newUnitName: string) => {
    if (!selectedItem) return;

    const currentFactor = item.uomFactor || 1;
    let newFactor = 1;

    if (newUnitName !== selectedItem.unit) {
      const conv = selectedItem.uomConversions?.find((c) => c.name === newUnitName);
      newFactor = conv?.factor || 1;
    }

    const baseQuantity = item.quantity * currentFactor;
    const baseRate = item.rate / currentFactor;
    const newQuantity = Math.round((baseQuantity / newFactor) * 1000) / 1000;
    const newRate = Math.round(baseRate * newFactor * 100) / 100;

    const baseAmount = newQuantity * newRate;
    const taxAmount = baseAmount * (item.taxRate / 100);

    onUpdate({
      ...item,
      unit: newUnitName,
      uomFactor: newFactor,
      quantity: newQuantity,
      rate: newRate,
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
        {/* S.No */}
        {sno !== undefined && (
          <td className="px-3 py-2 text-center text-sm text-gray-500 w-10">{sno}</td>
        )}

        {/* Item Selection */}
        <td className="px-3 py-2">
          {displayName ? (
            <div className="min-w-[180px]">
              <div className="flex flex-col">
                <span className="font-medium text-sm">{displayName}</span>
                {selectedItem && <span className="text-xs text-gray-500">{selectedItem.itemCode}</span>}
              </div>
              {!disabled && selectedItem && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsModalOpen(true)}
                  className="mt-1 h-7 text-xs text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-2"
                >
                  <Package className="h-3 w-3 mr-1" />
                  Change
                </Button>
              )}
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(true)}
              disabled={disabled}
              className="w-full min-w-[180px] justify-start text-left font-normal"
            >
              <Package className="h-4 w-4 mr-2" />
              Select item...
            </Button>
          )}
        </td>

        {/* HSN/SAC */}
        <td className="px-3 py-2 text-sm text-gray-600 w-20">
          {selectedItem?.hsnCode || "-"}
        </td>

        {/* Tax % */}
        <td className="px-3 py-2 text-sm text-gray-600 text-right w-16">
          {item.taxRate}%
        </td>

        {/* Quantity */}
        <td className="px-3 py-2 w-24">
          <Input
            type="number"
            min="1"
            step="1"
            value={item.quantity || ""}
            onChange={(e) => handleQuantityChange(e.target.value)}
            className="w-full text-right"
            disabled={disabled || !item.itemId}
          />
        </td>

        {/* Unit */}
        <td className="px-3 py-2 w-20">
          {selectedItem && selectedItem.uomConversions && selectedItem.uomConversions.length > 0 ? (
            <select
              value={item.unit || selectedItem.unit}
              onChange={(e) => handleUnitChange(e.target.value)}
              disabled={disabled || !item.itemId}
              className="w-full h-9 rounded-md border border-gray-200 px-2 text-sm bg-white disabled:opacity-50"
            >
              <option value={selectedItem.unit}>{selectedItem.unit}</option>
              {selectedItem.uomConversions.map((conv) => (
                <option key={conv.name} value={conv.name}>
                  {conv.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-gray-600 px-1">{selectedItem?.unit || "-"}</span>
          )}
        </td>

        {/* Rate ₹ */}
        <td className="px-3 py-2 w-28">
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={item.rate || ""}
            onChange={(e) => handleRateChange(e.target.value)}
            className="w-full text-right"
            disabled={disabled || !item.itemId}
          />
        </td>

        {/* Amount */}
        <td className="px-3 py-2 text-sm font-medium text-right w-28">
          {formatCurrency(item.amount + item.taxAmount)}
        </td>

        {/* Actions */}
        <td className="px-3 py-2 w-10">
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
