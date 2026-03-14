"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  X,
  Loader2,
  Search,
  Calendar,
  Settings2,
  Check,
  ChevronRight,
  ChevronDown,
  Tag,
  Layers,
  Package,
  Box,
} from "lucide-react";

interface Customer {
  id: string;
  customerNumber: string;
  name: string;
  gstin: string;
  city?: string;
  state?: string;
}

interface Item {
  id: string;
  itemCode: string;
  name: string;
  unit: string;
  mrp: number;
  brandId?: string;
  subBrandId?: string;
}

interface Brand {
  id: string;
  name: string;
}

interface SubBrand {
  id: string;
  name: string;
  brandId: string;
}

interface InclusionDiscount {
  id: string;
  discountPercent: number;
}

interface InclusionDiscounts {
  brands: InclusionDiscount[];
  subBrands: InclusionDiscount[];
  items: InclusionDiscount[];
}

interface SubBrandNode {
  subBrand: SubBrand;
  items: Item[];
}

interface BrandNode {
  brand: Brand;
  subBrandNodes: SubBrandNode[];
  directItems: Item[];
}

interface RateSheetCustomerEntry {
  customer: Customer;
}

interface RateSheet {
  id: string;
  name: string;
  customers: RateSheetCustomerEntry[];
  validFrom: string;
  validTo: string | null;
  discountPercent: number;
  isActive: boolean;
  useInclusionModel?: boolean;
  inclusionDiscounts?: InclusionDiscounts;
  excludedItemIds?: string[];
  excludedBrandIds?: string[];
  excludedSubBrandIds?: string[];
}

interface AddRateSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingRateSheet?: RateSheet | null;
}

export function AddRateSheetModal({
  isOpen,
  onClose,
  onSuccess,
  editingRateSheet,
}: AddRateSheetModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Customer data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomers, setSelectedCustomers] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Catalog data
  const [items, setItems] = useState<Item[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [subBrands, setSubBrands] = useState<SubBrand[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Discounts state
  const [inclusionDiscounts, setInclusionDiscounts] = useState<InclusionDiscounts>({
    brands: [],
    subBrands: [],
    items: [],
  });

  // Popup state
  const [showInclusionPopup, setShowInclusionPopup] = useState(false);
  const [inclusionSearch, setInclusionSearch] = useState("");
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [expandedSubBrands, setExpandedSubBrands] = useState<Set<string>>(new Set());
  const [expandedUnassigned, setExpandedUnassigned] = useState(true);

  // Form fields
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split("T")[0]);
  const [validTo, setValidTo] = useState("");
  const [isActive, setIsActive] = useState(true);

  const isEditing = !!editingRateSheet;

  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
      fetchData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (editingRateSheet) {
      setSelectedCustomers((editingRateSheet.customers || []).map((e) => e.customer));
      setValidFrom(editingRateSheet.validFrom.split("T")[0]);
      setValidTo(editingRateSheet.validTo ? editingRateSheet.validTo.split("T")[0] : "");
      setIsActive(editingRateSheet.isActive);
      if (editingRateSheet.inclusionDiscounts) {
        setInclusionDiscounts({
          brands: editingRateSheet.inclusionDiscounts.brands || [],
          subBrands: editingRateSheet.inclusionDiscounts.subBrands || [],
          items: editingRateSheet.inclusionDiscounts.items || [],
        });
      }
    } else {
      resetForm();
    }
  }, [editingRateSheet]);

  const fetchCustomers = async () => {
    setIsLoadingCustomers(true);
    try {
      const res = await fetch("/api/customers?limit=500");
      if (res.ok) setCustomers((await res.json()).customers || []);
    } catch (err) {
      console.error("Error fetching customers:", err);
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const fetchData = async () => {
    setIsLoadingData(true);
    try {
      const [itemsRes, brandsRes, subBrandsRes] = await Promise.all([
        fetch("/api/items?limit=1000"),
        fetch("/api/brands?limit=500"),
        fetch("/api/sub-brands?limit=500"),
      ]);
      if (itemsRes.ok) setItems((await itemsRes.json()).items || []);
      if (brandsRes.ok) setBrands((await brandsRes.json()).brands || []);
      if (subBrandsRes.ok) setSubBrands((await subBrandsRes.json()).subBrands || []);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setIsLoadingData(false);
    }
  };

  const resetForm = () => {
    setSelectedCustomers([]);
    setCustomerSearch("");
    setShowCustomerDropdown(false);
    setValidFrom(new Date().toISOString().split("T")[0]);
    setValidTo("");
    setIsActive(true);
    setInclusionDiscounts({ brands: [], subBrands: [], items: [] });
    setError(null);
    setShowInclusionPopup(false);
    setInclusionSearch("");
    setExpandedBrands(new Set());
    setExpandedSubBrands(new Set());
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // ── Discount helpers ────────────────────────────────────────────

  const getBrandDiscount = (id: string) =>
    inclusionDiscounts.brands.find((b) => b.id === id)?.discountPercent ?? null;
  const getSubBrandDiscount = (id: string) =>
    inclusionDiscounts.subBrands.find((sb) => sb.id === id)?.discountPercent ?? null;
  const getItemDiscount = (id: string) =>
    inclusionDiscounts.items.find((i) => i.id === id)?.discountPercent ?? null;

  const getEffectiveItemInfo = (item: Item): { source: string; percent: number } | null => {
    if (item.subBrandId) {
      const d = getSubBrandDiscount(item.subBrandId);
      if (d !== null) {
        const n = subBrands.find((s) => s.id === item.subBrandId)?.name || "Sub-brand";
        return { source: n, percent: d };
      }
    }
    if (item.brandId) {
      const d = getBrandDiscount(item.brandId);
      if (d !== null) {
        const n = brands.find((b) => b.id === item.brandId)?.name || "Brand";
        return { source: n, percent: d };
      }
    }
    return null;
  };

  const getSubBrandInheritedInfo = (
    sb: SubBrand
  ): { source: string; percent: number } | null => {
    const d = getBrandDiscount(sb.brandId);
    if (d !== null) {
      const n = brands.find((b) => b.id === sb.brandId)?.name || "Brand";
      return { source: n, percent: d };
    }
    return null;
  };

  // ── Toggle / update ─────────────────────────────────────────────

  const toggleBrand = (id: string) =>
    setInclusionDiscounts((prev) => {
      const exists = prev.brands.find((b) => b.id === id);
      return {
        ...prev,
        brands: exists
          ? prev.brands.filter((b) => b.id !== id)
          : [...prev.brands, { id, discountPercent: 0 }],
      };
    });

  const toggleSubBrand = (id: string) =>
    setInclusionDiscounts((prev) => {
      const exists = prev.subBrands.find((sb) => sb.id === id);
      return {
        ...prev,
        subBrands: exists
          ? prev.subBrands.filter((sb) => sb.id !== id)
          : [...prev.subBrands, { id, discountPercent: 0 }],
      };
    });

  const toggleItem = (id: string) =>
    setInclusionDiscounts((prev) => {
      const exists = prev.items.find((i) => i.id === id);
      return {
        ...prev,
        items: exists
          ? prev.items.filter((i) => i.id !== id)
          : [...prev.items, { id, discountPercent: 0 }],
      };
    });

  const updateBrandDiscount = (id: string, pct: number) =>
    setInclusionDiscounts((prev) => ({
      ...prev,
      brands: prev.brands.map((b) => (b.id === id ? { ...b, discountPercent: pct } : b)),
    }));

  const updateSubBrandDiscount = (id: string, pct: number) =>
    setInclusionDiscounts((prev) => ({
      ...prev,
      subBrands: prev.subBrands.map((sb) =>
        sb.id === id ? { ...sb, discountPercent: pct } : sb
      ),
    }));

  const updateItemDiscount = (id: string, pct: number) =>
    setInclusionDiscounts((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === id ? { ...i, discountPercent: pct } : i)),
    }));

  // ── Expand / collapse ──────────────────────────────────────────

  const toggleBrandExpanded = (id: string) =>
    setExpandedBrands((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const toggleSubBrandExpanded = (id: string) =>
    setExpandedSubBrands((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  // ── Tree structure ─────────────────────────────────────────────

  const brandTree = useMemo(
    (): BrandNode[] =>
      brands.map((brand) => ({
        brand,
        subBrandNodes: subBrands
          .filter((sb) => sb.brandId === brand.id)
          .map((sb) => ({ subBrand: sb, items: items.filter((i) => i.subBrandId === sb.id) })),
        directItems: items.filter((i) => i.brandId === brand.id && !i.subBrandId),
      })),
    [brands, subBrands, items]
  );

  const unassignedItems = useMemo(
    () => items.filter((i) => !i.brandId),
    [items]
  );

  // ── Search-filtered tree ───────────────────────────────────────

  const { filteredTree, filteredUnassigned } = useMemo(() => {
    const q = inclusionSearch.trim().toLowerCase();
    if (!q) return { filteredTree: brandTree, filteredUnassigned: unassignedItems };

    const tree = brandTree
      .map((node) => {
        const bMatch = node.brand.name.toLowerCase().includes(q);
        const filteredSubs = node.subBrandNodes
          .map((sbn) => {
            const sMatch = sbn.subBrand.name.toLowerCase().includes(q);
            const filteredItems = sbn.items.filter(
              (i) =>
                i.name.toLowerCase().includes(q) || i.itemCode.toLowerCase().includes(q)
            );
            // When brand matches, all its sub-brands appear (FK relationship).
            // When only sub-brand or items match, filter accordingly.
            if (bMatch || sMatch || filteredItems.length > 0) {
              return { ...sbn, items: bMatch || sMatch ? sbn.items : filteredItems };
            }
            return null;
          })
          .filter(Boolean) as SubBrandNode[];
        const directFiltered = node.directItems.filter(
          (i) =>
            bMatch ||
            i.name.toLowerCase().includes(q) ||
            i.itemCode.toLowerCase().includes(q)
        );
        if (bMatch || filteredSubs.length > 0 || directFiltered.length > 0) {
          return { ...node, subBrandNodes: filteredSubs, directItems: directFiltered };
        }
        return null;
      })
      .filter(Boolean) as BrandNode[];

    return {
      filteredTree: tree,
      filteredUnassigned: unassignedItems.filter(
        (i) =>
          i.name.toLowerCase().includes(q) || i.itemCode.toLowerCase().includes(q)
      ),
    };
  }, [inclusionSearch, brandTree, unassignedItems]);

  // Auto-expand matching branches on search
  useEffect(() => {
    if (!inclusionSearch.trim()) return;
    const q = inclusionSearch.trim().toLowerCase();
    const nb = new Set<string>();
    const ns = new Set<string>();
    brandTree.forEach((node) => {
      const bMatch = node.brand.name.toLowerCase().includes(q);
      const hasSub = node.subBrandNodes.some(
        (sbn) =>
          sbn.subBrand.name.toLowerCase().includes(q) ||
          sbn.items.some(
            (i) => i.name.toLowerCase().includes(q) || i.itemCode.toLowerCase().includes(q)
          )
      );
      const hasDirect = node.directItems.some(
        (i) => i.name.toLowerCase().includes(q) || i.itemCode.toLowerCase().includes(q)
      );
      if (bMatch || hasSub || hasDirect) {
        nb.add(node.brand.id);
        // Expand all sub-brands under a matched brand (FK relationship).
        node.subBrandNodes.forEach((sbn) => ns.add(sbn.subBrand.id));
      }
    });
    setExpandedBrands(nb);
    setExpandedSubBrands(ns);
  }, [inclusionSearch, brandTree]);

  // ── Customer helpers ────────────────────────────────────────────

  const selectedIds = new Set(selectedCustomers.map((c) => c.id));
  const filteredCustomers = customers.filter(
    (c) =>
      !selectedIds.has(c.id) &&
      (c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.customerNumber.toLowerCase().includes(customerSearch.toLowerCase()))
  );

  const handleCustomerAdd = (customer: Customer) => {
    setSelectedCustomers((prev) => [...prev, customer]);
    setCustomerSearch("");
    setShowCustomerDropdown(false);
  };

  const handleCustomerRemove = (id: string) =>
    setSelectedCustomers((prev) => prev.filter((c) => c.id !== id));

  const totalInclusions =
    inclusionDiscounts.brands.length +
    inclusionDiscounts.subBrands.length +
    inclusionDiscounts.items.length;

  // ── Submit ──────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (selectedCustomers.length === 0) { setError("Please select at least one customer"); return; }
    if (!validFrom) { setError("Please enter a valid from date"); return; }
    if (totalInclusions === 0) {
      setError("Please configure at least one brand, sub-brand, or item discount");
      return;
    }
    setIsSubmitting(true);
    try {
      const generatedName = `Rate Sheet - ${validFrom} - ${selectedCustomers.length} customer(s)`;
      const payload = {
        name: generatedName,
        customerIds: selectedCustomers.map((c) => c.id),
        validFrom,
        validTo: validTo || null,
        discountPercent: 0,
        isActive,
        useInclusionModel: true,
        inclusionDiscounts,
        excludedItemIds: [],
        excludedBrandIds: [],
        excludedSubBrandIds: [],
      };
      const url = isEditing ? `/api/rate-sheets/${editingRateSheet!.id}` : "/api/rate-sheets";
      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save rate sheet");
      }
      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // ── Item row ────────────────────────────────────────────────────

  const renderItemRow = (item: Item, indentClass: string) => {
    const itemDiscount = getItemDiscount(item.id);
    const isChecked = itemDiscount !== null;
    const inheritedInfo = !isChecked ? getEffectiveItemInfo(item) : null;
    const mrp = Number(item.mrp) || 0;
    const effectivePct = isChecked
      ? (itemDiscount ?? 0)
      : (inheritedInfo?.percent ?? 0);
    const priceAfter = mrp > 0 && effectivePct > 0 ? mrp * (1 - effectivePct / 100) : null;

    return (
      <div
        key={item.id}
        className={`flex items-center gap-2 pr-4 py-2 transition-colors ${indentClass} ${
          isChecked ? "bg-teal-50/60" : "hover:bg-gray-50"
        }`}
      >
        <Package className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
        <button
          type="button"
          onClick={() => toggleItem(item.id)}
          className="flex-shrink-0"
          aria-label={`${isChecked ? "Remove" : "Add"} ${item.name}`}
        >
          <div
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
              isChecked
                ? "bg-teal-500 border-teal-500"
                : "border-gray-300 hover:border-teal-400"
            }`}
          >
            {isChecked && <Check className="h-2.5 w-2.5 text-white" />}
          </div>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
          <p className="text-xs text-gray-400">{item.itemCode}</p>
        </div>
        {isChecked ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={itemDiscount ?? 0}
                onChange={(e) => updateItemDiscount(item.id, parseFloat(e.target.value) || 0)}
                className="w-16 h-7 text-xs text-right px-1.5"
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
              />
              <span className="text-xs text-gray-500">%</span>
            </div>
            {mrp > 0 && (
              <div className="text-xs text-right min-w-[90px]">
                <span className="text-gray-400">MRP ₹{mrp.toFixed(2)}</span>
                {priceAfter !== null && (
                  <span className="text-green-600 font-semibold ml-1">→ ₹{priceAfter.toFixed(2)}</span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-shrink-0">
            {inheritedInfo ? (
              <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded whitespace-nowrap">
                {inheritedInfo.percent}% via {inheritedInfo.source}
                {priceAfter !== null && mrp > 0 && (
                  <span className="text-blue-700 font-medium"> → ₹{priceAfter.toFixed(2)}</span>
                )}
              </span>
            ) : (
              mrp > 0 && <span className="text-xs text-gray-300">₹{mrp.toFixed(2)}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} aria-hidden="true" />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? "Edit Rate Sheet" : "New Rate Sheet"}
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Customers */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Customers <span className="text-red-500">*</span>
            </label>
            {isLoadingCustomers ? (
              <div className="flex items-center gap-2 text-gray-500 p-3">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading customers...
              </div>
            ) : (
              <div className="space-y-2">
                {selectedCustomers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCustomers.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-1.5 bg-teal-50 border border-teal-200 rounded-lg px-2.5 py-1"
                      >
                        <div>
                          <p className="text-sm font-medium text-teal-900 leading-tight">{c.name}</p>
                          <p className="text-xs text-teal-600 leading-tight">{c.customerNumber}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCustomerRemove(c.id)}
                          className="text-teal-500 hover:text-teal-700 ml-1"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search and add customers..."
                    value={customerSearch}
                    onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="pl-10"
                  />
                </div>
                {showCustomerDropdown && customerSearch && (
                  <div className="border rounded-lg max-h-40 overflow-y-auto shadow-sm">
                    {filteredCustomers.length === 0 ? (
                      <p className="p-3 text-gray-500 text-sm">No customers found</p>
                    ) : (
                      filteredCustomers.slice(0, 10).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleCustomerAdd(c)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0"
                        >
                          <p className="font-medium text-sm">{c.name}</p>
                          <p className="text-xs text-gray-500">
                            {c.customerNumber}
                            {c.gstin && ` | ${c.gstin}`}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Valid From <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Valid To{" "}
                <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="date"
                  value={validTo}
                  onChange={(e) => setValidTo(e.target.value)}
                  className="pl-10"
                  min={validFrom}
                />
              </div>
            </div>
          </div>

          {/* Configure Discounts CTA */}
          <div>
            <button
              type="button"
              onClick={() => setShowInclusionPopup(true)}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 border-dashed border-gray-200 hover:border-teal-300 hover:bg-teal-50/30 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 group-hover:bg-teal-200 transition-colors flex-shrink-0">
                  <Settings2 className="h-4 w-4 text-teal-600" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-800">Configure Discounts</p>
                  <p className="text-xs text-gray-500">Browse brands → sub-brands → items and set discount %</p>
                </div>
              </div>
              {totalInclusions > 0 ? (
                <div className="flex flex-wrap items-center gap-1 ml-3">
                  {inclusionDiscounts.brands.length > 0 && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                      {inclusionDiscounts.brands.length}B
                    </span>
                  )}
                  {inclusionDiscounts.subBrands.length > 0 && (
                    <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-medium">
                      {inclusionDiscounts.subBrands.length}SB
                    </span>
                  )}
                  {inclusionDiscounts.items.length > 0 && (
                    <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                      {inclusionDiscounts.items.length}I
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-gray-400 ml-3 flex-shrink-0">Click to set up →</span>
              )}
            </button>
          </div>

          {/* Active */}
          <div className="flex items-center justify-between p-4 bg-gray-50 border rounded-xl">
            <div>
              <p className="font-medium text-gray-900">Active</p>
              <p className="text-sm text-gray-500">
                {isActive ? "Discounts will be applied to orders" : "Discounts will NOT be applied"}
              </p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
              className="data-[state=checked]:bg-teal-500"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-teal-500 hover:bg-teal-600 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isEditing ? "Updating..." : "Creating..."}
              </>
            ) : isEditing ? (
              "Update Rate Sheet"
            ) : (
              "Create Rate Sheet"
            )}
          </Button>
        </div>
      </div>

      {/* ── Configure Discounts Popup ──────────────────────────────── */}
      {showInclusionPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowInclusionPopup(false)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
            {/* Popup header */}
            <div className="flex items-center justify-between px-5 py-4 border-b bg-white">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Configure Discounts</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Check brands, sub-brands or items — set individual discount %
                </p>
              </div>
              <button
                onClick={() => setShowInclusionPopup(false)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b bg-white">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search brands, sub-brands, or items..."
                  value={inclusionSearch}
                  onChange={(e) => setInclusionSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 px-5 py-2 border-b bg-gray-50 text-xs text-gray-400">
              <div className="flex items-center gap-1.5">
                <Tag className="h-3 w-3 text-orange-500" />
                <span>Brand</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Layers className="h-3 w-3 text-sky-500" />
                <span>Sub-brand</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Package className="h-3 w-3 text-gray-400" />
                <span>Item</span>
              </div>
              <span className="ml-auto text-blue-400">Blue = inherited discount</span>
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto">
              {isLoadingData ? (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading catalog...</span>
                </div>
              ) : (
                <div>
                  {filteredTree.map((node) => {
                    const { brand, subBrandNodes, directItems } = node;
                    const isExpanded = expandedBrands.has(brand.id);
                    const brandDiscount = getBrandDiscount(brand.id);
                    const isBrandChecked = brandDiscount !== null;
                    const totalItems =
                      subBrandNodes.reduce((s, sbn) => s + sbn.items.length, 0) +
                      directItems.length;

                    return (
                      <div key={brand.id} className="border-b border-gray-100 last:border-b-0">
                        {/* Brand row */}
                        <div
                          className={`flex items-center gap-2 px-4 py-3 transition-colors ${
                            isBrandChecked ? "bg-orange-50" : "hover:bg-gray-50"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleBrandExpanded(brand.id)}
                            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                            aria-label={isExpanded ? "Collapse" : "Expand"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleBrand(brand.id)}
                            className="flex-shrink-0"
                          >
                            <div
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                                isBrandChecked
                                  ? "bg-orange-500 border-orange-500"
                                  : "border-gray-300 hover:border-orange-400"
                              }`}
                            >
                              {isBrandChecked && <Check className="h-2.5 w-2.5 text-white" />}
                            </div>
                          </button>
                          <Tag className="h-4 w-4 text-orange-500 flex-shrink-0" />
                          <span className="text-sm font-semibold text-gray-800 flex-1 truncate">
                            {brand.name}
                          </span>
                          <span className="text-xs text-gray-400 flex-shrink-0 mr-2">
                            {subBrandNodes.length > 0 && `${subBrandNodes.length} sub · `}
                            {totalItems} items
                          </span>
                          {isBrandChecked && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={brandDiscount ?? 0}
                                onChange={(e) =>
                                  updateBrandDiscount(brand.id, parseFloat(e.target.value) || 0)
                                }
                                className="w-16 h-7 text-xs text-right px-1.5"
                                onClick={(e) => e.stopPropagation()}
                                onFocus={(e) => e.target.select()}
                              />
                              <span className="text-xs text-gray-500">%</span>
                            </div>
                          )}
                        </div>

                        {/* Brand children */}
                        {isExpanded && (
                          <div className="border-l-2 border-orange-100 ml-9">
                            {/* Sub-brands */}
                            {subBrandNodes.map((sbn) => {
                              const isSubExpanded = expandedSubBrands.has(sbn.subBrand.id);
                              const sbDiscount = getSubBrandDiscount(sbn.subBrand.id);
                              const isSubChecked = sbDiscount !== null;
                              const inheritedFromBrand = !isSubChecked
                                ? getSubBrandInheritedInfo(sbn.subBrand)
                                : null;

                              return (
                                <div key={sbn.subBrand.id}>
                                  {/* Sub-brand row */}
                                  <div
                                    className={`flex items-center gap-2 pl-3 pr-4 py-2.5 transition-colors border-b border-gray-50 ${
                                      isSubChecked ? "bg-sky-50" : "hover:bg-gray-50"
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => toggleSubBrandExpanded(sbn.subBrand.id)}
                                      className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                                    >
                                      {isSubExpanded ? (
                                        <ChevronDown className="h-3.5 w-3.5" />
                                      ) : (
                                        <ChevronRight className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toggleSubBrand(sbn.subBrand.id)}
                                      className="flex-shrink-0"
                                    >
                                      <div
                                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                                          isSubChecked
                                            ? "bg-sky-500 border-sky-500"
                                            : "border-gray-300 hover:border-sky-400"
                                        }`}
                                      >
                                        {isSubChecked && <Check className="h-2.5 w-2.5 text-white" />}
                                      </div>
                                    </button>
                                    <Layers className="h-3.5 w-3.5 text-sky-500 flex-shrink-0" />
                                    <span className="text-sm font-medium text-gray-700 flex-1 truncate">
                                      {sbn.subBrand.name}
                                    </span>
                                    <span className="text-xs text-gray-400 mr-2 flex-shrink-0">
                                      {sbn.items.length} items
                                    </span>
                                    {!isSubChecked && inheritedFromBrand && (
                                      <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded mr-2 flex-shrink-0">
                                        {inheritedFromBrand.percent}% via {inheritedFromBrand.source}
                                      </span>
                                    )}
                                    {isSubChecked && (
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <Input
                                          type="number"
                                          min="0"
                                          max="100"
                                          step="0.01"
                                          value={sbDiscount ?? 0}
                                          onChange={(e) =>
                                            updateSubBrandDiscount(
                                              sbn.subBrand.id,
                                              parseFloat(e.target.value) || 0
                                            )
                                          }
                                          className="w-16 h-7 text-xs text-right px-1.5"
                                          onClick={(e) => e.stopPropagation()}
                                          onFocus={(e) => e.target.select()}
                                        />
                                        <span className="text-xs text-gray-500">%</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Items under sub-brand */}
                                  {isSubExpanded && (
                                    <div className="border-l-2 border-sky-100 ml-6">
                                      {sbn.items.length === 0 ? (
                                        <p className="pl-8 pr-4 py-2 text-xs text-gray-400 italic">
                                          No items in this sub-brand
                                        </p>
                                      ) : (
                                        sbn.items.map((item) =>
                                          renderItemRow(item, "pl-8")
                                        )
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Direct brand items (no sub-brand) */}
                            {directItems.map((item) => renderItemRow(item, "pl-3"))}

                            {/* Empty brand */}
                            {subBrandNodes.length === 0 && directItems.length === 0 && (
                              <p className="pl-3 pr-4 py-2 text-xs text-gray-400 italic">
                                No sub-brands or items
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Unassigned / imported items */}
                  {filteredUnassigned.length > 0 && (
                    <div className="border-t border-amber-100">
                      <div
                        className="flex items-center gap-2 px-4 py-3 bg-amber-50 hover:bg-amber-100 cursor-pointer transition-colors"
                        onClick={() => setExpandedUnassigned((v) => !v)}
                      >
                        <button type="button" className="flex-shrink-0 text-amber-500">
                          {expandedUnassigned ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <Box className="h-4 w-4 text-amber-500 flex-shrink-0" />
                        <span className="text-sm font-semibold text-amber-800 flex-1">
                          Unassigned / Imported Items
                        </span>
                        <span className="text-xs text-amber-600 flex-shrink-0">
                          {filteredUnassigned.length} items — brand not linked yet
                        </span>
                      </div>
                      {expandedUnassigned && (
                        <div className="border-l-2 border-amber-100 ml-9">
                          {filteredUnassigned.map((item) => renderItemRow(item, "pl-3"))}
                        </div>
                      )}
                    </div>
                  )}

                  {filteredTree.length === 0 && filteredUnassigned.length === 0 && (
                    <p className="text-center text-gray-400 py-12 text-sm">
                      {inclusionSearch ? "No results found" : "No brands or items available"}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Popup footer */}
            <div className="border-t px-5 py-3.5 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-gray-600">
                {inclusionDiscounts.brands.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Tag className="h-3 w-3 text-orange-500" />
                    {inclusionDiscounts.brands.length} brand{inclusionDiscounts.brands.length !== 1 ? "s" : ""}
                  </span>
                )}
                {inclusionDiscounts.subBrands.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3 w-3 text-sky-500" />
                    {inclusionDiscounts.subBrands.length} sub-brand{inclusionDiscounts.subBrands.length !== 1 ? "s" : ""}
                  </span>
                )}
                {inclusionDiscounts.items.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Package className="h-3 w-3 text-teal-500" />
                    {inclusionDiscounts.items.length} item{inclusionDiscounts.items.length !== 1 ? "s" : ""}
                  </span>
                )}
                {totalInclusions === 0 && (
                  <span className="text-gray-400">Nothing selected yet</span>
                )}
              </div>
              <Button
                type="button"
                onClick={() => setShowInclusionPopup(false)}
                className="bg-teal-500 hover:bg-teal-600 text-white"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
