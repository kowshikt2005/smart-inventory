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

export interface InclusionDiscounts {
  brands: InclusionDiscount[];
  subBrands: InclusionDiscount[];
  items: InclusionDiscount[];
}

export interface RateSheetFormData {
  name: string;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  inclusionDiscounts: InclusionDiscounts;
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

interface RateSheetEditorProps {
  value: RateSheetFormData;
  onChange: (data: RateSheetFormData) => void;
  compact?: boolean;
}

export function RateSheetEditor({ value, onChange, compact }: RateSheetEditorProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [subBrands, setSubBrands] = useState<SubBrand[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [showInclusionPopup, setShowInclusionPopup] = useState(false);
  const [inclusionSearch, setInclusionSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "brands" | "subbrands" | "items">("all");
  // Drill-down filters: clicking a brand/sub-brand row filters the next tab
  const [drillBrandId, setDrillBrandId] = useState<string | null>(null);
  const [drillSubBrandId, setDrillSubBrandId] = useState<string | null>(null);
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [expandedSubBrands, setExpandedSubBrands] = useState<Set<string>>(new Set());
  const [expandedUnassigned, setExpandedUnassigned] = useState(true);

  const fetchData = async () => {
    if (dataLoaded) return;
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
      setDataLoaded(true);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (showInclusionPopup && !dataLoaded) {
      fetchData();
    }
  }, [showInclusionPopup, dataLoaded]);

  const update = (partial: Partial<RateSheetFormData>) => onChange({ ...value, ...partial });

  const { inclusionDiscounts } = value;
  const totalInclusions =
    inclusionDiscounts.brands.length +
    inclusionDiscounts.subBrands.length +
    inclusionDiscounts.items.length;

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

  // ── Price preview (MRP → final after discount) ─────────────────
  const getPricePreview = (discountPct: number, relevantItems: Item[]) => {
    if (discountPct <= 0) return null;
    const mrps = relevantItems.map((i) => Number(i.mrp) || 0).filter((m) => m > 0);
    if (mrps.length === 0) return null;
    const factor = 1 - discountPct / 100;
    return { min: Math.min(...mrps) * factor, max: Math.max(...mrps) * factor, count: mrps.length };
  };

  // ── Toggle / update ─────────────────────────────────────────────

  const toggleBrand = (id: string) => {
    const exists = inclusionDiscounts.brands.find((b) => b.id === id);
    update({
      inclusionDiscounts: {
        ...inclusionDiscounts,
        brands: exists
          ? inclusionDiscounts.brands.filter((b) => b.id !== id)
          : [...inclusionDiscounts.brands, { id, discountPercent: 0 }],
      },
    });
  };

  const toggleSubBrand = (id: string) => {
    const exists = inclusionDiscounts.subBrands.find((sb) => sb.id === id);
    update({
      inclusionDiscounts: {
        ...inclusionDiscounts,
        subBrands: exists
          ? inclusionDiscounts.subBrands.filter((sb) => sb.id !== id)
          : [...inclusionDiscounts.subBrands, { id, discountPercent: 0 }],
      },
    });
  };

  const toggleItem = (id: string) => {
    const exists = inclusionDiscounts.items.find((i) => i.id === id);
    update({
      inclusionDiscounts: {
        ...inclusionDiscounts,
        items: exists
          ? inclusionDiscounts.items.filter((i) => i.id !== id)
          : [...inclusionDiscounts.items, { id, discountPercent: 0 }],
      },
    });
  };

  const updateBrandDiscount = (id: string, pct: number) => {
    const oldPct = getBrandDiscount(id) ?? 0;
    const brandSubs = subBrands.filter((sb) => sb.brandId === id);
    const brandSubIds = new Set(brandSubs.map((sb) => sb.id));

    // Index existing discounts for O(1) lookup
    const sbMap = new Map(inclusionDiscounts.subBrands.map((sb) => [sb.id, sb.discountPercent]));
    const itemMap = new Map(inclusionDiscounts.items.map((i) => [i.id, i.discountPercent]));

    // 1. Update the brand
    const newBrands = inclusionDiscounts.brands.map((b) =>
      b.id === id ? { ...b, discountPercent: pct } : b
    );

    // 2. Cascade to sub-brands: update inherited ones, add missing ones
    const newSubBrands = inclusionDiscounts.subBrands.map((sb) =>
      brandSubIds.has(sb.id) && sb.discountPercent === oldPct
        ? { ...sb, discountPercent: pct }
        : sb
    );
    for (const sb of brandSubs) {
      if (!sbMap.has(sb.id)) newSubBrands.push({ id: sb.id, discountPercent: pct });
    }

    // 3. Cascade to items under this brand (direct + via sub-brands)
    const allBrandItems = items.filter(
      (i) => (i.brandId === id && !i.subBrandId) || (i.subBrandId != null && brandSubIds.has(i.subBrandId))
    );
    const brandItemMap = new Map(allBrandItems.map((i) => [i.id, i]));

    const newItems = inclusionDiscounts.items.map((item) => {
      const src = brandItemMap.get(item.id);
      if (!src) return item;
      const sbOldPct = src.subBrandId ? (sbMap.get(src.subBrandId) ?? oldPct) : oldPct;
      return item.discountPercent === oldPct || item.discountPercent === sbOldPct
        ? { ...item, discountPercent: pct }
        : item;
    });
    for (const item of allBrandItems) {
      if (!itemMap.has(item.id)) newItems.push({ id: item.id, discountPercent: pct });
    }

    update({ inclusionDiscounts: { brands: newBrands, subBrands: newSubBrands, items: newItems } });
  };

  const updateSubBrandDiscount = (id: string, pct: number) => {
    const oldPct = getSubBrandDiscount(id) ?? 0;
    const sbItems = items.filter((i) => i.subBrandId === id);
    const sbItemIds = new Set(sbItems.map((i) => i.id));
    const itemMap = new Map(inclusionDiscounts.items.map((i) => [i.id, i.discountPercent]));

    // 1. Update the sub-brand
    const newSubBrands = inclusionDiscounts.subBrands.map((sb) =>
      sb.id === id ? { ...sb, discountPercent: pct } : sb
    );

    // 2. Cascade to items: update inherited ones, add missing ones
    const newItems = inclusionDiscounts.items.map((item) =>
      sbItemIds.has(item.id) && item.discountPercent === oldPct
        ? { ...item, discountPercent: pct }
        : item
    );
    for (const item of sbItems) {
      if (!itemMap.has(item.id)) newItems.push({ id: item.id, discountPercent: pct });
    }

    update({ inclusionDiscounts: { brands: inclusionDiscounts.brands, subBrands: newSubBrands, items: newItems } });
  };

  const updateItemDiscount = (id: string, pct: number) =>
    update({
      inclusionDiscounts: {
        ...inclusionDiscounts,
        items: inclusionDiscounts.items.map((i) =>
          i.id === id ? { ...i, discountPercent: pct } : i
        ),
      },
    });

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

  // ── Tree ───────────────────────────────────────────────────────

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

  const unassignedItems = useMemo(() => items.filter((i) => !i.brandId), [items]);

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

  // ── Item row ────────────────────────────────────────────────────

  const renderItemRow = (item: Item, indentClass: string) => {
    const itemDiscount = getItemDiscount(item.id);
    const isChecked = itemDiscount !== null;
    const inheritedInfo = !isChecked ? getEffectiveItemInfo(item) : null;
    const mrp = Number(item.mrp) || 0;
    const effectivePct = isChecked ? (itemDiscount ?? 0) : (inheritedInfo?.percent ?? 0);
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
                  <span className="text-green-600 font-semibold ml-1">
                    → ₹{priceAfter.toFixed(2)}
                  </span>
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

  return (
    <>
      <div className={compact ? "space-y-4" : "space-y-5"}>
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Rate Sheet Name <span className="text-red-500">*</span>
          </label>
          <Input
            value={value.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="e.g., Premium Customer Rate"
          />
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
                value={value.validFrom}
                onChange={(e) => update({ validFrom: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Valid To <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="date"
                value={value.validTo}
                onChange={(e) => update({ validTo: e.target.value })}
                className="pl-10"
                min={value.validFrom}
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
                <p className="text-xs text-gray-500">Browse brands → sub-brands → items</p>
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
              {value.isActive
                ? "Discounts will be applied to orders"
                : "Discounts will NOT be applied"}
            </p>
          </div>
          <Switch
            checked={value.isActive}
            onCheckedChange={(checked) => update({ isActive: checked })}
            className="data-[state=checked]:bg-teal-500"
          />
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
            {/* Header */}
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

            {/* Tabs */}
            <div className="flex items-center gap-1 px-5 py-2 border-b bg-gray-50">
              {(["all", "brands", "subbrands", "items"] as const).map((tab) => {
                const labels = { all: "All", brands: "Brands", subbrands: "Sub-brands", items: "Items" };
                const icons = {
                  all: <Layers className="h-3 w-3" />,
                  brands: <Tag className="h-3 w-3 text-orange-500" />,
                  subbrands: <Layers className="h-3 w-3 text-sky-500" />,
                  items: <Package className="h-3 w-3 text-teal-500" />,
                };
                const counts = {
                  all: null,
                  brands: inclusionDiscounts.brands.length || null,
                  subbrands: inclusionDiscounts.subBrands.length || null,
                  items: inclusionDiscounts.items.length || null,
                };
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => { setActiveTab(tab); if (tab === "brands") { setDrillBrandId(null); setDrillSubBrandId(null); } }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activeTab === tab
                        ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {icons[tab]}
                    {labels[tab]}
                    {counts[tab] !== null && (
                      <span className="ml-0.5 bg-teal-100 text-teal-700 rounded-full px-1.5 py-0 text-[10px]">
                        {counts[tab]}
                      </span>
                    )}
                  </button>
                );
              })}
              <span className="ml-auto text-[10px] text-blue-400">Blue = inherited</span>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {isLoadingData ? (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading catalog...</span>
                </div>
              ) : activeTab === "brands" ? (
                /* ── Flat Brands list ─────────────────────────── */
                <div>
                  {(inclusionSearch
                    ? brands.filter((b) => b.name.toLowerCase().includes(inclusionSearch.toLowerCase()))
                    : brands
                  ).map((brand) => {
                    const d = getBrandDiscount(brand.id);
                    const isChecked = d !== null;
                    const subCount = subBrands.filter((sb) => sb.brandId === brand.id).length;
                    const itemCount = items.filter((i) => i.brandId === brand.id).length;
                    return (
                      <div
                        key={brand.id}
                        className={`flex items-center gap-3 px-5 py-3 border-b border-gray-50 transition-colors ${isChecked ? "bg-orange-50" : "hover:bg-gray-50"}`}
                      >
                        <button type="button" onClick={() => toggleBrand(brand.id)} className="flex-shrink-0">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${isChecked ? "bg-orange-500 border-orange-500" : "border-gray-300 hover:border-orange-400"}`}>
                            {isChecked && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                        </button>
                        <Tag className="h-4 w-4 text-orange-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{brand.name}</p>
                          <p className="text-xs text-gray-400">{subCount} sub-brands · {itemCount} items</p>
                        </div>
                        {isChecked && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Input
                              type="number" min="0" max="100" step="0.01"
                              value={d ?? 0}
                              onChange={(e) => updateBrandDiscount(brand.id, parseFloat(e.target.value) || 0)}
                              className="w-16 h-7 text-xs text-right px-1.5"
                              onClick={(e) => e.stopPropagation()}
                              onFocus={(e) => e.target.select()}
                            />
                            <span className="text-xs text-gray-500 mr-1">%</span>
                          </div>
                        )}
                        {/* Drill into sub-brands */}
                        <button
                          type="button"
                          title="View sub-brands & items"
                          onClick={() => { setDrillBrandId(brand.id); setDrillSubBrandId(null); setActiveTab("subbrands"); setInclusionSearch(""); }}
                          className="flex-shrink-0 p-1 rounded hover:bg-orange-100 text-gray-400 hover:text-orange-600"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                  {brands.length === 0 && <p className="text-center text-gray-400 py-10 text-sm">No brands available</p>}
                </div>
              ) : activeTab === "subbrands" ? (
                /* ── Flat Sub-brands list (filtered by drillBrandId) ── */
                <div>
                  {/* Breadcrumb: explicit drill-down */}
                  {drillBrandId && (
                    <div className="flex items-center gap-2 px-5 py-2 bg-orange-50 border-b border-orange-100 text-xs text-orange-700">
                      <Tag className="h-3 w-3" />
                      <span className="font-medium">{brands.find((b) => b.id === drillBrandId)?.name}</span>
                      <span className="text-orange-400">— showing related sub-brands only</span>
                      <button type="button" onClick={() => setDrillBrandId(null)} className="ml-auto text-orange-400 hover:text-orange-600">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {/* Breadcrumb: auto-filter by selected brands / sub-brands */}
                  {!drillBrandId && !inclusionSearch && (inclusionDiscounts.brands.length > 0 || inclusionDiscounts.subBrands.length > 0) && (
                    <div className="flex items-center gap-2 px-5 py-2 bg-orange-50/60 border-b border-orange-100 text-xs text-orange-600">
                      <Tag className="h-3 w-3" />
                      <span className="font-medium truncate">
                        {(() => {
                          // Collect parent-brand names from both selected brands and selected sub-brands
                          const nameSet = new Set<string>();
                          inclusionDiscounts.brands.forEach((b) => {
                            const n = brands.find((br) => br.id === b.id)?.name;
                            if (n) nameSet.add(n);
                          });
                          inclusionDiscounts.subBrands.forEach((sb) => {
                            const parentId = subBrands.find((s) => s.id === sb.id)?.brandId;
                            if (parentId) {
                              const n = brands.find((br) => br.id === parentId)?.name;
                              if (n) nameSet.add(n);
                            }
                          });
                          const names = Array.from(nameSet);
                          return names.length <= 3 ? names.join(", ") : `${names.length} selected brands`;
                        })()}
                      </span>
                      <span className="text-orange-400 flex-shrink-0">— linked sub-brands</span>
                    </div>
                  )}
                  {(() => {
                    let list = subBrands;
                    if (drillBrandId) {
                      list = list.filter((sb) => sb.brandId === drillBrandId);
                    } else if (!inclusionSearch && (inclusionDiscounts.brands.length > 0 || inclusionDiscounts.subBrands.length > 0)) {
                      // Auto-filter: sub-brands linked to selected brands OR
                      // sibling sub-brands of selected sub-brands (same parent brand)
                      const scopedBrandIds = new Set(inclusionDiscounts.brands.map((b) => b.id));
                      inclusionDiscounts.subBrands.forEach((sb) => {
                        const parentId = subBrands.find((s) => s.id === sb.id)?.brandId;
                        if (parentId) scopedBrandIds.add(parentId);
                      });
                      list = list.filter((sb) => scopedBrandIds.has(sb.brandId));
                    }
                    if (inclusionSearch) {
                      const q = inclusionSearch.toLowerCase();
                      list = list.filter((sb) => sb.name.toLowerCase().includes(q) || brands.find((b) => b.id === sb.brandId)?.name.toLowerCase().includes(q));
                    }
                    if (list.length === 0) {
                      return <p className="text-center text-gray-400 py-10 text-sm">No sub-brands for this selection</p>;
                    }
                    return list.map((sb) => {
                      const d = getSubBrandDiscount(sb.id);
                      const isChecked = d !== null;
                      const inherited = !isChecked ? getSubBrandInheritedInfo(sb) : null;
                      const parentBrand = brands.find((b) => b.id === sb.brandId);
                      const itemCount = items.filter((i) => i.subBrandId === sb.id).length;
                      return (
                        <div
                          key={sb.id}
                          className={`flex items-center gap-3 px-5 py-3 border-b border-gray-50 transition-colors ${isChecked ? "bg-sky-50" : "hover:bg-gray-50"}`}
                        >
                          <button type="button" onClick={() => toggleSubBrand(sb.id)} className="flex-shrink-0">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${isChecked ? "bg-sky-500 border-sky-500" : "border-gray-300 hover:border-sky-400"}`}>
                              {isChecked && <Check className="h-2.5 w-2.5 text-white" />}
                            </div>
                          </button>
                          <Layers className="h-4 w-4 text-sky-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800">{sb.name}</p>
                            <p className="text-xs text-gray-400">{parentBrand?.name} · {itemCount} items</p>
                          </div>
                          {!isChecked && inherited && (
                            <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded mr-1 flex-shrink-0">
                              {inherited.percent}% via {inherited.source}
                            </span>
                          )}
                          {isChecked && (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number" min="0" max="100" step="0.01"
                                  value={d ?? 0}
                                  onChange={(e) => updateSubBrandDiscount(sb.id, parseFloat(e.target.value) || 0)}
                                  className="w-16 h-7 text-xs text-right px-1.5"
                                  onClick={(e) => e.stopPropagation()}
                                  onFocus={(e) => e.target.select()}
                                />
                                <span className="text-xs text-gray-500">%</span>
                              </div>
                            </div>
                          )}
                          {/* Drill into items */}
                          <button
                            type="button"
                            title="View items"
                            onClick={() => { setDrillSubBrandId(sb.id); setDrillBrandId(sb.brandId); setActiveTab("items"); setInclusionSearch(""); }}
                            className="flex-shrink-0 p-1 rounded hover:bg-sky-100 text-gray-400 hover:text-sky-600"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : activeTab === "items" ? (
                /* ── Flat Items list (filtered by drill) ─────── */
                <div>
                  {/* Breadcrumb filter chips */}
                  {(drillBrandId || drillSubBrandId) && (
                    <div className="flex items-center gap-2 px-5 py-2 bg-teal-50 border-b border-teal-100 text-xs text-teal-700">
                      {drillBrandId && (
                        <span className="flex items-center gap-1">
                          <Tag className="h-3 w-3 text-orange-500" />
                          {brands.find((b) => b.id === drillBrandId)?.name}
                        </span>
                      )}
                      {drillSubBrandId && (
                        <>
                          <ChevronRight className="h-3 w-3 text-gray-400" />
                          <span className="flex items-center gap-1">
                            <Layers className="h-3 w-3 text-sky-500" />
                            {subBrands.find((sb) => sb.id === drillSubBrandId)?.name}
                          </span>
                        </>
                      )}
                      <span className="text-teal-400">— related items only</span>
                      <button
                        type="button"
                        onClick={() => { setDrillBrandId(null); setDrillSubBrandId(null); }}
                        className="ml-auto text-teal-400 hover:text-teal-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {/* Breadcrumb: auto-filter by selected brands/sub-brands */}
                  {!drillBrandId && !drillSubBrandId && !inclusionSearch && (inclusionDiscounts.brands.length > 0 || inclusionDiscounts.subBrands.length > 0) && (
                    <div className="flex items-center gap-2 px-5 py-2 bg-teal-50/60 border-b border-teal-100 text-xs text-teal-600">
                      {inclusionDiscounts.brands.length > 0 && (
                        <span className="flex items-center gap-1 truncate">
                          <Tag className="h-3 w-3 text-orange-500 flex-shrink-0" />
                          {inclusionDiscounts.brands.length <= 3
                            ? inclusionDiscounts.brands.map((b) => brands.find((br) => br.id === b.id)?.name).filter(Boolean).join(", ")
                            : `${inclusionDiscounts.brands.length} brands`}
                        </span>
                      )}
                      {inclusionDiscounts.subBrands.length > 0 && (
                        <span className="flex items-center gap-1 truncate">
                          <Layers className="h-3 w-3 text-sky-500 flex-shrink-0" />
                          {inclusionDiscounts.subBrands.length <= 3
                            ? inclusionDiscounts.subBrands.map((sb) => subBrands.find((s) => s.id === sb.id)?.name).filter(Boolean).join(", ")
                            : `${inclusionDiscounts.subBrands.length} sub-brands`}
                        </span>
                      )}
                      <span className="text-teal-400 flex-shrink-0">— related items</span>
                    </div>
                  )}
                  {(() => {
                    let list = items;
                    if (drillSubBrandId) {
                      list = list.filter((i) => i.subBrandId === drillSubBrandId);
                    } else if (drillBrandId) {
                      list = list.filter((i) => i.brandId === drillBrandId);
                    } else if (!inclusionSearch && (inclusionDiscounts.brands.length > 0 || inclusionDiscounts.subBrands.length > 0)) {
                      if (inclusionDiscounts.subBrands.length > 0) {
                        // Sub-brands selected → they are the most specific filter,
                        // show ONLY items under those exact sub-brands.
                        const selectedSubBrandIds = new Set(inclusionDiscounts.subBrands.map((sb) => sb.id));
                        list = list.filter((i) => i.subBrandId != null && selectedSubBrandIds.has(i.subBrandId));
                      } else {
                        // Only brands selected → show all items of those brands
                        const selectedBrandIds = new Set(inclusionDiscounts.brands.map((b) => b.id));
                        const linkedSubBrandIds = new Set(
                          subBrands.filter((sb) => selectedBrandIds.has(sb.brandId)).map((sb) => sb.id)
                        );
                        list = list.filter(
                          (i) =>
                            (i.brandId != null && selectedBrandIds.has(i.brandId)) ||
                            (i.subBrandId != null && linkedSubBrandIds.has(i.subBrandId))
                        );
                      }
                    }
                    if (inclusionSearch) {
                      const q = inclusionSearch.toLowerCase();
                      // Search narrows by name/code + resolves FK chain
                      const matchedBrandIds = new Set(
                        brands.filter((b) => b.name.toLowerCase().includes(q)).map((b) => b.id)
                      );
                      const matchedSubBrandIds = new Set(
                        subBrands
                          .filter((sb) => sb.name.toLowerCase().includes(q) || matchedBrandIds.has(sb.brandId))
                          .map((sb) => sb.id)
                      );
                      list = list.filter(
                        (i) =>
                          i.name.toLowerCase().includes(q) ||
                          i.itemCode.toLowerCase().includes(q) ||
                          (i.brandId != null && matchedBrandIds.has(i.brandId)) ||
                          (i.subBrandId != null && matchedSubBrandIds.has(i.subBrandId))
                      );
                    }
                    if (list.length === 0) return <p className="text-center text-gray-400 py-10 text-sm">No items for this selection</p>;
                    return list.map((item) => renderItemRow(item, "px-5"));
                  })()}
                </div>
              ) : (
                /* ── All: existing tree view ──────────────────── */
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
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="flex items-center gap-1">
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
                            </div>
                          )}
                        </div>

                        {/* Brand children */}
                        {isExpanded && (
                          <div className="border-l-2 border-orange-100 ml-9">
                            {subBrandNodes.map((sbn) => {
                              const isSubExpanded = expandedSubBrands.has(sbn.subBrand.id);
                              const sbDiscount = getSubBrandDiscount(sbn.subBrand.id);
                              const isSubChecked = sbDiscount !== null;
                              const inheritedFromBrand = !isSubChecked
                                ? getSubBrandInheritedInfo(sbn.subBrand)
                                : null;

                              return (
                                <div key={sbn.subBrand.id}>
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
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <div className="flex items-center gap-1">
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
                                      </div>
                                    )}
                                  </div>

                                  {isSubExpanded && (
                                    <div className="border-l-2 border-sky-100 ml-6">
                                      {sbn.items.length === 0 ? (
                                        <p className="pl-8 pr-4 py-2 text-xs text-gray-400 italic">
                                          No items in this sub-brand
                                        </p>
                                      ) : (
                                        sbn.items.map((item) => renderItemRow(item, "pl-8"))
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {directItems.map((item) => renderItemRow(item, "pl-3"))}

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

            {/* Footer */}
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
                {totalInclusions === 0 && <span className="text-gray-400">Nothing selected yet</span>}
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
    </>
  );
}

export const emptyRateSheetFormData: RateSheetFormData = {
  name: "",
  validFrom: new Date().toISOString().split("T")[0],
  validTo: "",
  isActive: true,
  inclusionDiscounts: { brands: [], subBrands: [], items: [] },
};
