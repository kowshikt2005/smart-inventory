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
import { Plus, MoreHorizontal, Eye, Edit, Loader2, X, Package, Trash2, Tag, Layers, ArrowRight, PowerOff, Power, Wand2, CheckCircle2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
    openingStock: string | number;
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
  const [stockAdjustResult, setStockAdjustResult] = useState<{ previous: number; next: number; diff: number } | null>(null);
  const [stockAdjustError, setStockAdjustError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<Item | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resolveConfirmOpen, setResolveConfirmOpen] = useState(false);
  const [resolveResult, setResolveResult] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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

  const handleEditItem = async (itemId: string) => {
    const items = data?.items || [];
    const item = items.find((i: Item) => i.id === itemId);
    if (!item) return;

    let itemForEdit: Item = item;

    try {
      const response = await fetch(`/api/items/${itemId}`);
      if (response.ok) {
        const fullItem = await response.json();
        itemForEdit = fullItem;
      }
    } catch {
      // Fallback to list-row data if full fetch fails.
    }

    setEditingItem(itemForEdit);
    setShowAddModal(true);
  };

  const handleDeleteItem = (item: Item) => {
    setDeleteConfirmItem(item);
  };

  const executeDeleteItem = async () => {
    if (!deleteConfirmItem) return;
    setDeletingId(deleteConfirmItem.id);
    setActionError(null);
    try {
      const response = await fetch(`/api/items/${deleteConfirmItem.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to delete item");
      mutate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete item");
    } finally {
      setDeletingId(null);
      setDeleteConfirmItem(null);
    }
  };

  const handleToggleStatus = async (item: Item) => {
    setTogglingId(item.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (!res.ok) throw new Error();
      mutate();
    } catch {
      setActionError("Failed to update item status. Please try again.");
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
      setStockAdjustError("Please enter a valid stock amount.");
      return;
    }

    setIsAdjustingStock(true);
    setStockAdjustError(null);

    try {
      const response = await fetch(`/api/items/${adjustingStockItem.id}/adjust-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStock, notes: stockNotes || undefined }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to adjust stock");

      mutate();
      setStockAdjustResult({
        previous: data.previousPhysicalStock,
        next: data.newPhysicalStock,
        diff: data.adjustment,
      });
      setNewStockValue("");
      setStockNotes("");
    } catch (err) {
      setStockAdjustError(err instanceof Error ? err.message : "Failed to adjust stock");
    } finally {
      setIsAdjustingStock(false);
    }
  };

  const handleResolve = async () => {
    setResolveConfirmOpen(true);
  };

  const executeResolve = async () => {
    setResolveConfirmOpen(false);
    setIsResolving(true);
    setActionError(null);
    try {
      const res = await fetch('/api/items/resolve-imported', { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to resolve');
      mutate();
      const brands = result.created?.brands?.join(', ') || 'none';
      const subBrands = result.created?.subBrands?.join(', ') || 'none';
      setResolveResult(`${result.message} (Brands: ${brands}, Sub-brands: ${subBrands})`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to resolve imported items');
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-4">Items</h1>

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
                <h3 className="text-sm font-semibold text-foreground">Brands</h3>
                <p className="text-xs text-muted-foreground">Manage product brands</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-all group-hover:translate-x-0.5 shrink-0" />
            </Link>
            <Link
              href="/masters/items/sub-brands"
              className="group flex items-center gap-4 rounded-xl border border-sky-200 hover:border-sky-300 bg-white p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 shrink-0">
                <Layers className="h-5 w-5 text-sky-600" strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Sub-brands</h3>
                <p className="text-xs text-muted-foreground">Manage sub-brand categories</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-all group-hover:translate-x-0.5 shrink-0" />
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="text-sm text-muted-foreground mt-2">
                  Found {filteredItems.length} item
                  {filteredItems.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ImportButton entityType="ITEM" entityLabel="Items" onSuccess={() => mutate()} />
              <Button className="bg-primary hover:bg-primary/90 text-white" onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </div>
        </div>

        {actionError && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="ml-4 text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {resolveResult && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{resolveResult}</span>
            </div>
            <button onClick={() => setResolveResult(null)} className="ml-4 text-green-400 hover:text-green-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

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
        <div className="rounded-xl border border-border/60 bg-white shadow-sm overflow-hidden">
          <Table aria-label="Items list">
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-semibold text-center w-[60px]">S.No.</TableHead>
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
                <TableHead scope="col" className="font-semibold">Opening Stock</TableHead>
                <TableHead scope="col" className="font-semibold">Stock</TableHead>
                <TableHead scope="col" className="font-semibold">Status</TableHead>
                <TableHead scope="col" className="font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={14} className="text-center text-muted-foreground py-12">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading items...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={14} className="text-center text-red-600 py-8">
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
                  <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
                    {searchQuery
                      ? "No items found matching your search"
                      : "No items yet. Click 'Add Item' to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((item: Item, rowIndex) => (
                  <TableRow key={item.id} className={
                    !item.isActive ? "opacity-50 bg-muted/20" :
                    (item.isImported && !item.brand) ? "bg-yellow-50 hover:bg-yellow-100" :
                    undefined
                  }>
                    <TableCell className="text-center text-muted-foreground">{(currentPage - 1) * itemsPerPage + rowIndex + 1}</TableCell>
                    <TableCell className="font-mono">{item.itemCode}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.brand?.name || item.importedBrandName || "N/A"}</TableCell>
                    <TableCell>{item.subBrand?.name || item.importedSubBrandName || "N/A"}</TableCell>
                    <TableCell>{item.hsnCode || "N/A"}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>{Number(item.gstRate)}%</TableCell>
                    <TableCell>₹{Number(item.purchasePrice).toFixed(2)}</TableCell>
                    <TableCell>₹{Number(item.mrp).toFixed(2)}</TableCell>
                    <TableCell>₹{Number(item.sellingPrice).toFixed(2)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {Number(item.inventory?.openingStock || 0).toFixed(3).replace(/\.?0+$/, '') || "0"}
                      <span className="text-xs text-muted-foreground/70 ml-1">{item.unit}</span>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const physical = Number(item.inventory?.physicalStock || 0);
                        const reserved = Number(item.inventory?.reservedQuantity || 0);
                        const available = physical - reserved;
                        return (
                          <div className="text-sm leading-tight">
                            <div className="font-medium text-foreground">
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
            <p className="text-sm text-muted-foreground">
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
              <span className="text-sm text-muted-foreground">
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
            const wasEditing = !!editingItem;
            mutate();
            if (!wasEditing) {
              setCurrentPage(1);
            }
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

        {/* Stock Adjustment Dialog */}
        <Dialog
          open={!!adjustingStockItem}
          onOpenChange={(open) => {
            if (!open) {
              setAdjustingStockItem(null);
              setNewStockValue("");
              setStockNotes("");
              setStockAdjustError(null);
              setStockAdjustResult(null);
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adjust Stock</DialogTitle>
            </DialogHeader>

            {adjustingStockItem && (
              <div className="space-y-4">
                {/* Item Info */}
                <div className="bg-muted/30 p-3 rounded-md">
                  <p className="text-sm text-muted-foreground">Item</p>
                  <p className="font-medium text-foreground">{adjustingStockItem.name}</p>
                  <p className="text-sm text-muted-foreground font-mono">{adjustingStockItem.itemCode}</p>
                </div>

                {stockAdjustResult ? (
                  /* Success state */
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-green-700 font-medium">
                      <CheckCircle2 className="h-5 w-5" />
                      Stock adjusted successfully
                    </div>
                    <div className="text-sm text-green-600 space-y-1">
                      <p>Previous: <strong>{stockAdjustResult.previous}</strong></p>
                      <p>New: <strong>{stockAdjustResult.next}</strong></p>
                      <p>Adjustment: <strong>{stockAdjustResult.diff > 0 ? '+' : ''}{stockAdjustResult.diff}</strong></p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Current Stock Info */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Physical</p>
                        <p className="text-lg font-semibold text-foreground">
                          {Number(adjustingStockItem.inventory?.physicalStock || 0)}
                        </p>
                      </div>
                      <div className="text-center p-2 bg-yellow-50 rounded">
                        <p className="text-xs text-muted-foreground">Reserved</p>
                        <p className="text-lg font-semibold text-yellow-600">
                          {Number(adjustingStockItem.inventory?.reservedQuantity || 0)}
                        </p>
                      </div>
                      <div className="text-center p-2 bg-green-50 rounded">
                        <p className="text-xs text-muted-foreground">Available</p>
                        <p className="text-lg font-semibold text-green-600">
                          {Number(adjustingStockItem.inventory?.physicalStock || 0) - Number(adjustingStockItem.inventory?.reservedQuantity || 0)}
                        </p>
                      </div>
                    </div>

                    {stockAdjustError && (
                      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                        {stockAdjustError}
                      </p>
                    )}

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
                        onChange={(e) => { setNewStockValue(e.target.value); setStockAdjustError(null); }}
                        className="mt-1"
                        placeholder="Enter new physical stock"
                        disabled={isAdjustingStock}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Adjustment: {newStockValue && !isNaN(parseFloat(newStockValue))
                          ? `${parseFloat(newStockValue) - Number(adjustingStockItem.inventory?.physicalStock || 0) > 0 ? '+' : ''}${parseFloat(newStockValue) - Number(adjustingStockItem.inventory?.physicalStock || 0)}`
                          : '—'}
                      </p>
                    </div>

                    {/* Notes */}
                    <div>
                      <Label htmlFor="stockNotes" className="text-sm font-medium">
                        Notes <span className="text-muted-foreground font-normal">(optional)</span>
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
                  </>
                )}
              </div>
            )}

            <DialogFooter>
              {stockAdjustResult ? (
                <Button onClick={() => { setAdjustingStockItem(null); setStockAdjustResult(null); }}>
                  Done
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => { setAdjustingStockItem(null); setNewStockValue(""); setStockNotes(""); setStockAdjustError(null); }}
                    disabled={isAdjustingStock}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleStockAdjustmentSubmit}
                    disabled={isAdjustingStock || !newStockValue}
                    className="bg-primary hover:bg-primary/90 text-white"
                  >
                    {isAdjustingStock ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adjusting...</>
                    ) : (
                      "Confirm Adjustment"
                    )}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteConfirmItem} onOpenChange={(open) => { if (!open) setDeleteConfirmItem(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete item?</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>&ldquo;{deleteConfirmItem?.name}&rdquo;</strong> will be permanently deleted. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={!!deletingId}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={executeDeleteItem}
                disabled={!!deletingId}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {deletingId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Resolve Confirmation */}
        <AlertDialog open={resolveConfirmOpen} onOpenChange={setResolveConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Auto-create brands & sub-brands?</AlertDialogTitle>
              <AlertDialogDescription>
                This will create missing brands and sub-brands for {unresolvedCount} imported item{unresolvedCount !== 1 ? 's' : ''} and link them automatically.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={executeResolve}>
                Auto-create & Link
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
