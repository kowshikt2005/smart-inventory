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
import { Plus, MoreHorizontal, Eye, Edit, Loader2, X } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { AddItemModal } from "@/components/items/AddItemModal";

interface Item {
  id: string;
  itemCode: string;
  name: string;
  description?: string;
  standardPrice: string | number; // Prisma Decimal comes as string
  purchasePrice: string | number; // Prisma Decimal comes as string
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
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const itemsPerPage = 10;

  // Fetch items from API
  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/items?limit=100");

      if (!response.ok) {
        throw new Error("Failed to fetch items");
      }

      const data = await response.json();
      setItems(data.items || []);
    } catch (err: any) {
      setError(err.message);
      console.error("Error fetching items:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;

    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.itemCode.toLowerCase().includes(query) ||
        (item.brand?.name.toLowerCase().includes(query)) ||
        (item.hsnCode?.toLowerCase().includes(query))
    );
  }, [searchQuery, items]);

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
    console.log("View item:", itemId);
    // TODO: Navigate to item details
  };

  const handleEditItem = (itemId: string) => {
    console.log("Edit item:", itemId);
    // TODO: Open edit modal
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
                <TableHead scope="col" className="font-semibold">Sales Price</TableHead>
                <TableHead scope="col" className="font-semibold">MRP</TableHead>
                <TableHead scope="col" className="font-semibold">Stock</TableHead>
                <TableHead scope="col" className="font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-gray-500 py-12">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading items...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-red-600 py-8">
                    <div className="space-y-2">
                      <p>Error: {error}</p>
                      <Button onClick={fetchItems} variant="outline" size="sm">
                        Try Again
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-gray-500 py-8">
                    {searchQuery
                      ? "No items found matching your search"
                      : "No items yet. Click 'Add Item' to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.itemCode}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.brand?.name || "N/A"}</TableCell>
                    <TableCell>{item.subBrand?.name || "N/A"}</TableCell>
                    <TableCell>{item.hsnCode || "N/A"}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>GST @ {Number(item.gstRate)}%</TableCell>
                    <TableCell>₹{Number(item.standardPrice).toFixed(2)}</TableCell>
                    <TableCell>₹{Number(item.purchasePrice).toFixed(2)}</TableCell>
                    <TableCell>{Number(item.inventory?.physicalStock || 0)}</TableCell>
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

        {/* Add Item Modal */}
        <AddItemModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            fetchItems();
            setCurrentPage(1);
          }}
        />
      </div>
    </DashboardLayout>
  );
}