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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, MoreHorizontal, Eye, Edit, Loader2, X, Package, Trash2, Tag, Layers, ArrowRight, PowerOff, Power, Wand2 } from "lucide-react";
import { ImportButton } from "@/components/import/ImportButton";
import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { useDebounce } from "@/hooks/useDebounce";
import { AddItemModal } from "@/components/items/AddItemModal";

interface Item {
  id: string;
  itemCode: string;
  name: string;
  description?: string;
  purchasePrice: string | number;
  mrp: string | number;
  sellingPrice: string | number;
  unit: string;
  hsnCode?: string;
  gstRate: string | number;
  isActive: boolean;
  isImported?: boolean;
  importedBrandName?: string | null;
  importedSubBrandName?: string | null;
  brand?: { id: string; name: string } | null;
  subBrand?: { id: string; name: string } | null;
  inventory?: {
    physicalStock: string | number;
    reservedQuantity: string | number;
    minStockLevel: string | number;
  };
}

function ItemsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  // Read redirect-back intent from URL params (set by invoice pages)
  const returnTo = searchParams.get("returnTo");
  const invoiceItemId = searchParams.get("invoiceItemId");
  const invoiceType = searchParams.get("invoiceType") as "PURCHASE" | "SALES" | null;
  const prefillName = searchParams.get("prefillName");
  const prefillRate = searchParams.get("prefillRate");
  const prefillGstRate = searchParams.get("prefillGstRate");
  const prefillHsnCode = searchParams.get("prefillHsnCode");
  const prefillMrp = searchParams.get("prefillMrp");
  const prefillUnit = searchParams.get("prefillUnit");
  const prefillQuantity = searchParams.get("prefillQuantity");
  const openCreate = searchParams.get("openCreate") === "true";

  // Auto-open modal when redirected from an invoice page
  useEffect(() => {
    if (openCreate) {
      setShowAddModal(true);
    }
  }, [openCreate]);

  // useMemo ensures prefill data updates on soft navigation (when URL params change)
  // while staying stable across SWR re-renders (deps don't change within a page visit)
  const prefillData = useMemo(
    () =>
      openCreate
        ? {
            name: prefillName || undefined,
            purchasePrice: invoiceType === "PURCHASE" && prefillRate ? prefillRate : undefined,
            sellingPrice: invoiceType === "SALES" && prefillRate ? prefillRate : undefined,
            gstRate: prefillGstRate || undefined,
            hsnCode: prefillHsnCode || undefined,
            mrp: prefillMrp || undefined,
            unit: prefillUnit || undefined,
            quantity: prefillQuantity || undefined,
          }
        : undefined,
    [openCreate, prefillName, prefillRate, prefillGstRate, prefillHsnCode, prefillMrp, prefillUnit, prefillQuantity, invoiceType]
  );
  const [adjustingStockItem, setAdjustingStockItem] = useState<Item | null>(null);
  const [newStockValue, setNewStockValue] = useState("");
  const [stockNotes, setStockNotes] = useState("");
  const [isAdjustingStock, setIsAdjustingStock] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const itemsPerPage = 10;

  // Debounce search
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Use SWR for caching
  const { data, error, isLoading, mutate } = useSWR("/api/items?limit=9999");

  const unresolvedCount = useMemo(() => {
    return (data?.items || []).filter((i: Item) => i.isImported && !i.brand).length;
  }, [data]);

  // Filter items based on search query and status filter
  const filteredItems = useMemo(() => {
    let items: Item[] = data?.items || [];

    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      items = items.filter(
        (item: Item) =>
          item.name.toLowerCase().includes(query) ||
          item.itemCode.toLowerCase().includes(query) ||
          (item.brand?.name.toLowerCase().includes(query)) ||
          (item.hsnCode?.toLowerCase().includes(query))
      );
    }

    if (statusFilter !== "ALL") {
      items = items.filter(i => statusFilter === "ACTIVE" ? i.isActive : !i.isActive);
    }

    return items;
  }, [debouncedSearch, data, statusFilter]);

  const counts = useMemo(() => {
    const all: Item[] = data?.items || [];
    return { all: all.length, active: all.filter(i => i.isActive).length, inactive: all.filter(i => !i.isActive).length };
  }, [data]);

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

  const handleToggleStatus = async (item: Item) => {
    setTogglingId(item.id);
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (!res.ok) throw new Error();
      mutate();
    } catch {
      alert("Failed to update item status.");
    } finally {
      setTogglingId(null);
    }
  };

  const handleAdjustStock = (item: Item) => {
    setAdjustingStockItem(item);
    const physicalStock = Number(item.inventory?.physicalStock || 0);
    setNewStockValue(physicalStock.toString());
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
      alert(`Physical stock adjusted successfully!\nPrevious: ${data.previousPhysicalStock}\nNew: ${data.newPhysicalStock}\nAdjustment: ${data.adjustment > 0 ? '+' : ''}${data.adjustment}`);
    } catch (err) {
      console.error("Error adjusting stock:", err);
      alert(err instanceof Error ? err.message : "Failed to adjust stock");
    } finally {
      setIsAdjustingStock(false);
    }
  };

  const handleResolve = async () => {
    if (!confirm(`Auto-create missing brands and sub-brands for ${unresolvedCount} imported item${unresolvedCount !== 1 ? 's' : ''}?`)) return;
    setIsResolving(true);
    try {
      const res = await fetch('/api/items/resolve-imported', { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to resolve');
      mutate();
      alert(`${result.message}\nBrands created: ${result.created?.brands?.join(', ') || 'none'}\nSub-brands created: ${result.created?.subBrands?.join(', ') || 'none'}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resolve imported items');
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Items</h1>

          {/* Quick Nav Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <Link
              href="/masters/items/brands"
              className="group flex items-center gap-4 rounded-xl border border-orange-200 hover:border-orange-300 bg-white p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 shrink-0">
                <Tag className="h-5 w-5 text-orange-600" strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900">Brands</h3>
                <p className="text-xs text-gray-500">Manage product brands</p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-all group-hover:translate-x-0.5 shrink-0" />
            </Link>
            <Link
              href="/masters/items/sub-brands"
              className="group flex items-center gap-4 rounded-xl border border-sky-200 hover:border-sky-300 bg-white p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 shrink-0">
                <Layers className="h-5 w-5 text-sky-600" strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900">Sub-brands</h3>
                <p className="text-xs text-gray-500">Manage sub-brand categories</p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-all group-hover:translate-x-0.5 shrink-0" />
            </Link>
          </div>

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
            <div className="flex items-center gap-2">
              <ImportButton entityType="ITEM" entityLabel="Items" onSuccess={() => mutate()} />
              <Button className="bg-teal-500 hover:bg-teal-600 text-white" onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </div>
        </div>

        {/* Resolve imported items banner */}
        {unresolvedCount > 0 && (
          <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-4">
            <p className="text-sm text-yellow-800 font-medium">
              {unresolvedCount} imported item{unresolvedCount !== 1 ? 's' : ''} have missing brands/sub-brands.
            </p>
            <Button
              size="sm"
              onClick={handleResolve}
              disabled={isResolving}
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              {isResolving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
              {isResolving ? 'Resolving...' : 'Auto-create & Link'}
            </Button>
          </div>
        )}

        {/* Status Filter Tabs */}
        <div className="flex gap-1 border-b border-border mb-0 mt-2">
          {(["ALL", "ACTIVE", "INACTIVE"] as const).map((f) => (
            <button key={f} onClick={() => { setStatusFilter(f); setCurrentPage(1); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${statusFilter === f ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {f === "ALL" ? "All" : f === "ACTIVE" ? "Active" : "Inactive"}
              <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">
                {f === "ALL" ? counts.all : f === "ACTIVE" ? counts.active : counts.inactive}
              </span>
            </button>
          ))}
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
                <TableHead scope="col" className="font-semibold">Stock</TableHead>
                <TableHead scope="col" className="font-semibold">Status</TableHead>
                <TableHead scope="col" className="font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center text-gray-500 py-12">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading items...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center text-red-600 py-8">
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
                  <TableCell colSpan={13} className="text-center text-gray-500 py-8">
                    {searchQuery
                      ? "No items found matching your search"
                      : "No items yet. Click 'Add Item' to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((item: Item) => (
                  <TableRow key={item.id} className={
                    !item.isActive ? "opacity-50 bg-muted/20" :
                    (item.isImported && !item.brand) ? "bg-yellow-50 hover:bg-yellow-100" :
                    undefined
                  }>
                    <TableCell className="font-mono">{item.itemCode}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.brand?.name || item.importedBrandName || "N/A"}</TableCell>
                    <TableCell>{item.subBrand?.name || item.importedSubBrandName || "N/A"}</TableCell>
                    <TableCell>{item.hsnCode || "N/A"}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>GST @ {Number(item.gstRate)}%</TableCell>
                    <TableCell>₹{Number(item.purchasePrice).toFixed(2)}</TableCell>
                    <TableCell>₹{Number(item.mrp).toFixed(2)}</TableCell>
                    <TableCell>₹{Number(item.sellingPrice).toFixed(2)}</TableCell>
                    <TableCell>
                      {(() => {
                        const physical = Number(item.inventory?.physicalStock || 0);
                        const reserved = Number(item.inventory?.reservedQuantity || 0);
                        const available = physical - reserved;
                        return (
                          <div className="text-sm leading-tight">
                            <div className="font-medium text-gray-900">
                              {physical} <span className="text-xs font-normal text-muted-foreground">total</span>
                            </div>
                            {reserved > 0 && (
                              <div className="text-xs text-yellow-600">
                                {reserved} reserved
                              </div>
                            )}
                            <div className={`text-xs font-medium ${available > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {available} available
                            </div>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {item.isActive ? (
                        <Badge variant="default" className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-500 border-gray-200">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            aria-label={`Actions for ${item.name}`}
                            disabled={togglingId === item.id}
                          >
                            {togglingId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
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
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleToggleStatus(item)} className={item.isActive ? "text-amber-600 focus:text-amber-600" : "text-green-600 focus:text-green-600"}>
                            {item.isActive ? (
                              <>
                                <PowerOff className="h-4 w-4 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <Power className="h-4 w-4 mr-2" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
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
          onSuccess={async (item) => {
            mutate();
            setCurrentPage(1);
            setEditingItem(null);
            // If opened from an invoice, link the new item and redirect back
            if (returnTo && invoiceItemId && invoiceType) {
              try {
                await fetch("/api/import/link-invoice-item", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ itemId: item.id, invoiceItemId, invoiceType }),
                });
              } catch {
                // Linking failed silently — user is still redirected; they can re-link manually
              }
              router.push(returnTo);
            }
          }}
          editItem={editingItem}
          prefillData={prefillData}
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
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <p className="text-xs text-gray-600">Physical</p>
                    <p className="text-lg font-semibold">
                      {Number(adjustingStockItem.inventory?.physicalStock || 0)}
                    </p>
                  </div>
                  <div className="text-center p-2 bg-yellow-50 rounded">
                    <p className="text-xs text-gray-600">Reserved</p>
                    <p className="text-lg font-semibold text-yellow-600">
                      {Number(adjustingStockItem.inventory?.reservedQuantity || 0)}
                    </p>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded">
                    <p className="text-xs text-gray-600">Available</p>
                    <p className="text-lg font-semibold text-green-600">
                      {Number(adjustingStockItem.inventory?.physicalStock || 0) - Number(adjustingStockItem.inventory?.reservedQuantity || 0)}
                    </p>
                  </div>
                </div>

                {/* New Stock Input */}
                <div>
                  <Label htmlFor="newStock" className="text-sm font-medium">
                    New Physical Stock
                  </Label>
                  <Input
                    id="newStock"
                    type="number"
                    min="0"
                    step="1"
                    value={newStockValue}
                    onChange={(e) => setNewStockValue(e.target.value)}
                    className="mt-1"
                    placeholder="Enter new physical stock"
                    disabled={isAdjustingStock}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Adjustment: {newStockValue && !isNaN(parseFloat(newStockValue))
                      ? `${parseFloat(newStockValue) - Number(adjustingStockItem.inventory?.physicalStock || 0) > 0 ? '+' : ''}${parseFloat(newStockValue) - Number(adjustingStockItem.inventory?.physicalStock || 0)}`
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

export default function ItemsPage() {
  return (
    <Suspense>
      <ItemsContent />
    </Suspense>
  );
}