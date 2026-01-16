"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2, AlertCircle } from "lucide-react";
import { useMemo } from "react";

interface Item {
  id: string;
  itemCode: string;
  name: string;
  unit: string;
  hsnCode: string | null;
  gstRate: number;
  standardPrice: number;
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
  // Get selected item details
  const selectedItem = useMemo(
    () => items.find((i) => i.id === item.itemId),
    [items, item.itemId]
  );

  // Filter available items (not already selected, except current)
  const availableItems = useMemo(
    () =>
      items.filter(
        (i) => !selectedItemIds.includes(i.id) || i.id === item.itemId
      ),
    [items, selectedItemIds, item.itemId]
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

  // Handle item selection
  const handleItemSelect = (itemId: string) => {
    // Just notify parent - let parent calculate the rate with rate sheet
    onUpdate({
      ...item,
      itemId,
      // Parent will recalculate rate, taxRate, amount, and taxAmount
    });
  };

  // Handle quantity change
  const handleQuantityChange = (value: string) => {
    const quantity = parseFloat(value) || 0;
    const amount = quantity * item.rate;
    const taxAmount = amount * (item.taxRate / 100);

    onUpdate({
      ...item,
      quantity,
      taxAmount: Math.round(taxAmount * 100) / 100,
      amount: Math.round(amount * 100) / 100,
    });
  };

  // Handle rate change
  const handleRateChange = (value: string) => {
    const rate = parseFloat(value) || 0;
    const amount = item.quantity * rate;
    const taxAmount = amount * (item.taxRate / 100);

    onUpdate({
      ...item,
      rate,
      taxAmount: Math.round(taxAmount * 100) / 100,
      amount: Math.round(amount * 100) / 100,
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
    <tr className={hasStockWarning ? "bg-yellow-50" : ""}>
      {/* Item Selection */}
      <td className="px-3 py-2">
        <Select
          value={item.itemId}
          onValueChange={handleItemSelect}
          disabled={disabled}
        >
          <SelectTrigger className="w-full min-w-[200px]">
            <SelectValue placeholder="Select item..." />
          </SelectTrigger>
          <SelectContent>
            {availableItems.map((availItem) => (
              <SelectItem key={availItem.id} value={availItem.id}>
                <div className="flex flex-col">
                  <span className="font-medium">{availItem.name}</span>
                  <span className="text-xs text-gray-500">
                    {availItem.itemCode}
                    {availItem.hsnCode && ` | HSN: ${availItem.hsnCode}`}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {/* Amount */}
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
  );
}
