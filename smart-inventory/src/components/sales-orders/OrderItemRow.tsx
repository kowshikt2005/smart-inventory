"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, AlertCircle, Package } from "lucide-react";
import { useMemo, useState } from "react";
import { ItemSelectionModal } from "./ItemSelectionModal";

interface Item {
  id: string;
  itemCode: string;
  name: string;
  unit: string;
  hsnCode: string | null;
  gstRate: number;
  purchasePrice: number; // Cost price
  mrp: number; // Maximum Retail Price
  sellingPrice: number; // Actual selling price (used as base rate)
  discountPercent?: number | null;
  inventory?: {
    physicalStock: number;
    reservedQuantity: number;
  } | null;
}

interface OrderItemData {
  id: string;
  itemId: string;
  quantity: number;
  rate: number;
  discountPercent: number;
  taxRate: number;
  taxAmount: number;
  amount: number;
}

interface OrderItemRowProps {
  item: OrderItemData;
  items: Item[];
  selectedItemIds: string[];
  onUpdate: (updatedItem: OrderItemData) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function OrderItemRow({
  item,
  items,
  selectedItemIds,
  onUpdate,
  onRemove,
  disabled = false,
}: OrderItemRowProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get selected item details
  const selectedItem = useMemo(
    () => items.find((i) => i.id === item.itemId),
    [items, item.itemId]
  );

  // Calculate available stock
  const availableStock = useMemo(() => {
    if (!selectedItem?.inventory) return 0;
    return (
      Number(selectedItem.inventory.physicalStock) -
      Number(selectedItem.inventory.reservedQuantity)
    );
  }, [selectedItem]);

  const hasStockWarning = selectedItem && item.quantity > availableStock;

  // Calculate discount percentage from MRP and actual Rate
  // MRP is the base price for rate sheet customers, so discount is shown relative to MRP
  const calculatedDiscountPercent = useMemo(() => {
    if (!selectedItem || !item.rate) return null;
    const mrp = Number(selectedItem.mrp);
    const rate = Number(item.rate);
    if (mrp <= 0 || rate >= mrp) return null;
    return ((mrp - rate) / mrp) * 100;
  }, [selectedItem, item.rate]);

  // Handle item selection
  const handleItemSelect = (selectedItemData: Item) => {
    // Just notify parent - let parent calculate the rate with rate sheet
    onUpdate({
      ...item,
      itemId: selectedItemData.id,
      // Parent will recalculate rate, taxRate, amount, and taxAmount
    });
  };

  // Calculate tax-inclusive amounts
  // Rate is tax-inclusive (MRP). We back-calculate base amount and tax.
  const calculateTaxInclusive = (inclusiveAmount: number, taxRate: number) => {
    const baseAmount = inclusiveAmount / (1 + taxRate / 100);
    const taxAmount = inclusiveAmount - baseAmount;
    return {
      baseAmount: Math.round(baseAmount * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
    };
  };

  // Handle quantity change
  const handleQuantityChange = (value: string) => {
    const quantity = parseFloat(value) || 0;
    const totalInclusive = quantity * item.rate; // Rate is tax-inclusive
    const { baseAmount, taxAmount } = calculateTaxInclusive(totalInclusive, item.taxRate);

    onUpdate({
      ...item,
      quantity,
      taxAmount,
      amount: baseAmount, // Base amount (excluding tax)
    });
  };

  // Handle rate change
  const handleRateChange = (value: string) => {
    const rate = parseFloat(value) || 0;
    const totalInclusive = item.quantity * rate; // Rate is tax-inclusive
    const { baseAmount, taxAmount } = calculateTaxInclusive(totalInclusive, item.taxRate);

    onUpdate({
      ...item,
      rate,
      taxAmount,
      amount: baseAmount, // Base amount (excluding tax)
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
      <tr className={hasStockWarning ? "bg-yellow-50" : ""}>
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
          {hasStockWarning && (
            <div className="flex items-center gap-1 text-xs text-yellow-600 mt-1">
              <AlertCircle className="h-3 w-3" />
              <span>Only {availableStock} available</span>
            </div>
          )}
        </td>

      {/* HSN Code */}
      <td className="px-3 py-2 text-sm text-gray-600">
        {selectedItem?.hsnCode || "-"}
      </td>

      {/* MRP */}
      <td className="px-3 py-2 text-sm text-gray-900 font-medium text-right">
        {selectedItem && Number(selectedItem.mrp) > 0
          ? formatCurrency(Number(selectedItem.mrp))
          : "-"}
      </td>

      {/* Discount Percent - Calculated from MRP and Rate */}
      <td className="px-3 py-2 text-sm text-green-600 font-medium text-right">
        {calculatedDiscountPercent !== null
          ? `${calculatedDiscountPercent.toFixed(2)}%`
          : "-"}
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

      {/* Net Rate (Rate excluding tax) */}
      <td className="px-3 py-2 text-sm text-gray-600 text-right">
        {item.rate > 0 && item.taxRate >= 0
          ? formatCurrency(item.rate / (1 + item.taxRate / 100))
          : "-"}
      </td>

      {/* Tax Rate */}
      <td className="px-3 py-2 text-sm text-gray-600 text-right">
        {item.taxRate}%
      </td>

      {/* Tax Amount */}
      <td className="px-3 py-2 text-sm text-gray-600 text-right">
        {formatCurrency(item.taxAmount)}
      </td>

      {/* Total (Rate is tax-inclusive, so total = quantity × rate) */}
      <td className="px-3 py-2 text-sm font-medium text-right">
        {formatCurrency(item.quantity * item.rate)}
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

    {/* Item Selection Modal - Rendered outside tbody using portal */}
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
