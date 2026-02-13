"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, MoreHorizontal, Eye, Edit, Loader2, X, Package, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useDebounce } from "@/hooks/useDebounce";
import { AddItemModal } from "@/components/items/AddItemModal";

interface Item {
  id: string;
  itemCode: string;
  name: string;
  description?: string;
  purchasePrice: string | number; // Cost price
  mrp: string | number; // Maximum Retail Price
  sellingPrice: string | number; // Actual selling price
  unit: string;
  hsnCode?: string;
  gstRate: string | number; // Prisma Decimal comes as string
  isActive: boolean;
  brand?: { id: string; name: string };
  subBrand?: { id: string; name: string };
  inventory?: {
    physicalStock: string | number; // Prisma Decimal comes as string
    reservedQuantity: string | number; // Prisma Decimal comes as string
    minStockLevel: string | number; // Prisma Decimal comes as string
  };
}

export default function ItemsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [adjustingStockItem, setAdjustingStockItem] = useState<Item | null>(null);
  const [newStockValue, setNewStockValue] = useState("");
  const [stockNotes, setStockNotes] = useState("");
  const [isAdjustingStock, setIsAdjustingStock] = useState(false);
  const itemsPerPage = 10;

  // Debounce search
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Use SWR for caching
  const { data, error, isLoading, mutate } = useSWR("/api/items?limit=100");

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    const items = data?.items || [];
    if (!debouncedSearch.trim()) return items;

    const query = debouncedSearch.toLowerCase();
    return items.filter(
      (item: Item) =>
        item.name.toLowerCase().includes(query) ||
        item.itemCode.toLowerCase().includes(query) ||
        (item.brand?.name.toLowerCase().includes(query)) ||
        (item.hsnCode?.toLowerCase().includes(query))
    );
  }, [debouncedSearch, data]);

  // Paginate items
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredItems.slice(startIndex, endIndex);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleViewItem = (itemId: string) => {
    router.push(`/masters/items/${itemId}`);
  };

  const handleEditItem = (itemId: string) => {
    const items = data?.items || [];
    const item = items.find((i: Item) => i.id === itemId);
    if (item) {
      setEditingItem(item);
      setShowAddModal(true);
    }
  };

  const handleDeleteItem = async (item: Item) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;

    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete item");
      }

      mutate();
    } catch (err) {
      console.error("Error deleting item:", err);
      alert(err instanceof Error ? err.message : "Failed to delete item");
    }
  };

  const handleAdjustStock = (item: Item) => {
    setAdjustingStockItem(item);
    const availableStock = Number(item.inventory?.physicalStock || 0) - Number(item.inventory?.reservedQuantity || 0);
    setNewStockValue(availableStock.toString());
    setStockNotes("");
  };

  const handleStockAdjustmentSubmit = async () => {
    if (!adjustingStockItem) return;

    const newStock = parseFloat(newStockValue);
    if (isNaN(newStock) || newStock < 0) {
      alert("Please enter a valid stock amount");
      return;
    }

    setIsAdjustingStock(true);

    try {
      const response = await fetch(`/api/items/${adjustingStockItem.id}/adjust-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newStock,
          notes: stockNotes || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to adjust stock");
      }

      // Refresh items list
      mutate();
      setAdjustingStockItem(null);
      setNewStockValue("");
      setStockNotes("");
      alert(`Available stock adjusted successfully!\nPrevious: ${data.previousAvailableStock}\nNew: ${data.newAvailableStock}\nAdjustment: ${data.adjustment > 0 ? '+' : ''}${data.adjustment}`);
    } catch (err) {
      console.error("Error adjusting stock:", err);
      alert(err instanceof Error ? err.message : "Failed to adjust stock");
    } finally {
      setIsAdjustingStock(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">All Items</h1>

          {/* Search and Add Button */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pr-8"
                />
                {searchQuery && (
                  <button
                    onClick={() => handleSearchChange("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="text-sm text-gray-600 mt-2">
                  Found {filteredItems.length} item
                  {filteredItems.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <Button className="bg-teal-500 hover:bg-teal-600 text-white" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        </div>

        {/* Items Table */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <Table aria-label="Items list">
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead scope="col" className="font-semibold">Code</TableHead>
                <TableHead scope="col" className="font-semibold">Name</TableHead>
                <TableHead scope="col" className="font-semibold">Brand</TableHead>
                <TableHead scope="col" className="font-semibold">Sub-brand</TableHead>
                <TableHead scope="col" className="font-semibold">HSN</TableHead>
                <TableHead scope="col" className="font-semibold">UOM</TableHead>
                <TableHead scope="col" className="font-semibold">Tax</TableHead>
                <TableHead scope="col" className="font-semibold">Cost</TableHead>
                <TableHead scope="col" className="font-semibold">MRP</TableHead>
                <TableHead scope="col" className="font-semibold">Selling</TableHead>
                <TableHead scope="col" className="font-semibold">Available</TableHead>
                <TableHead scope="col" className="font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-gray-500 py-12">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading items...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-red-600 py-8">
                    <div className="space-y-2">
                      <p>Error: {error.message || "Failed to load items"}</p>
                      <Button onClick={() => mutate()} variant="outline" size="sm">
                        Try Again
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-gray-500 py-8">
                    {searchQuery
                      ? "No items found matching your search"
                      : "No items yet. Click 'Add Item' to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((item: Item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.itemCode}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.brand?.name || "N/A"}</TableCell>
                    <TableCell>{item.subBrand?.name || "N/A"}</TableCell>
                    <TableCell>{item.hsnCode || "N/A"}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>GST @ {Number(item.gstRate)}%</TableCell>
                    <TableCell>₹{Number(item.purchasePrice).toFixed(2)}</TableCell>
                    <TableCell>₹{Number(item.mrp).toFixed(2)}</TableCell>
                    <TableCell>₹{Number(item.sellingPrice).toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className={`font-medium ${
                          Number(item.inventory?.physicalStock || 0) - Number(item.inventory?.reservedQuantity || 0) > 0 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {Number(item.inventory?.physicalStock || 0) - Number(item.inventory?.reservedQuantity || 0)} available
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            aria-label={`Actions for ${item.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewItem(item.id)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditItem(item.id)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Item
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAdjustStock(item)}>
                            <Package className="h-4 w-4 mr-2" />
                            Adjust Stock
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteItem(item)} className="text-red-600 focus:text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Item
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredItems.length)} of{" "}
              {filteredItems.length} items
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Add/Edit Item Modal */}
        <AddItemModal
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setEditingItem(null);
          }}
          onSuccess={() => {
            mutate();
            setCurrentPage(1);
            setEditingItem(null);
          }}
          editItem={editingItem}
        />

        {/* Stock Adjustment Modal */}
        {adjustingStockItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Adjust Stock</h2>

              <div className="space-y-4">
                {/* Item Info */}
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm text-gray-600">Item</p>
                  <p className="font-medium">{adjustingStockItem.name}</p>
                  <p className="text-sm text-gray-500 font-mono">{adjustingStockItem.itemCode}</p>
                </div>

                {/* Current Stock Info */}
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Current Available Stock</p>
                    <p className="text-lg font-semibold">
                      {Number(adjustingStockItem.inventory?.physicalStock || 0) - Number(adjustingStockItem.inventory?.reservedQuantity || 0)}
                    </p>
                  </div>
                </div>

                {/* New Stock Input */}
                <div>
                  <Label htmlFor="newStock" className="text-sm font-medium">
                    New Available Stock
                  </Label>
                  <Input
                    id="newStock"
                    type="number"
                    min="0"
                    step="1"
                    value={newStockValue}
                    onChange={(e) => setNewStockValue(e.target.value)}
                    className="mt-1"
                    placeholder="Enter new stock amount"
                    disabled={isAdjustingStock}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Adjustment: {newStockValue && !isNaN(parseFloat(newStockValue))
                      ? `${parseFloat(newStockValue) - (Number(adjustingStockItem.inventory?.physicalStock || 0) - Number(adjustingStockItem.inventory?.reservedQuantity || 0)) > 0 ? '+' : ''}${parseFloat(newStockValue) - (Number(adjustingStockItem.inventory?.physicalStock || 0) - Number(adjustingStockItem.inventory?.reservedQuantity || 0))}`
                      : '0'}
                  </p>
                </div>

                {/* Notes (Optional) */}
                <div>
                  <Label htmlFor="stockNotes" className="text-sm font-medium">
                    Notes (Optional)
                  </Label>
                  <Input
                    id="stockNotes"
                    type="text"
                    value={stockNotes}
                    onChange={(e) => setStockNotes(e.target.value)}
                    className="mt-1"
                    placeholder="e.g., Physical count, Damaged goods"
                    disabled={isAdjustingStock}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAdjustingStockItem(null);
                    setNewStockValue("");
                    setStockNotes("");
                  }}
                  disabled={isAdjustingStock}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleStockAdjustmentSubmit}
                  disabled={isAdjustingStock || !newStockValue}
                  className="bg-teal-500 hover:bg-teal-600 text-white"
                >
                  {isAdjustingStock ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adjusting...
                    </>
                  ) : (
                    "Confirm Adjustment"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}