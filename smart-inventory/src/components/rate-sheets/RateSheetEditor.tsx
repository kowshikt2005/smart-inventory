"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { X, Loader2, Search, Calendar, Settings2, Check } from "lucide-react";

interface Item {
  id: string;
  itemCode: string;
  name: string;
  unit: string;
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

interface RateSheetEditorProps {
  value: RateSheetFormData;
  onChange: (data: RateSheetFormData) => void;
  compact?: boolean;
}

type InclusionTab = "brands" | "subbrands" | "items";

export function RateSheetEditor({ value, onChange, compact }: RateSheetEditorProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [subBrands, setSubBrands] = useState<SubBrand[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [showInclusionPopup, setShowInclusionPopup] = useState(false);
  const [inclusionTab, setInclusionTab] = useState<InclusionTab>("brands");
  const [inclusionSearch, setInclusionSearch] = useState("");

  const fetchData = async () => {
    if (dataLoaded) return;
    setIsLoadingData(true);
    try {
      const [itemsRes, brandsRes, subBrandsRes] = await Promise.all([
        fetch("/api/items?limit=1000&activeOnly=true"),
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

  // Lazy load data only when opening inclusion popup
  useEffect(() => {
    if (showInclusionPopup && !dataLoaded) {
      fetchData();
    }
  }, [showInclusionPopup, dataLoaded]);

  const update = (partial: Partial<RateSheetFormData>) => {
    onChange({ ...value, ...partial });
  };

  const { inclusionDiscounts } = value;
  const totalInclusions =
    inclusionDiscounts.brands.length +
    inclusionDiscounts.subBrands.length +
    inclusionDiscounts.items.length;

  const getFilteredInclusionItems = () => {
    const query = inclusionSearch.toLowerCase();
    if (inclusionTab === "brands") {
      return brands.filter((b) => b.name.toLowerCase().includes(query));
    } else if (inclusionTab === "subbrands") {
      const brandIds = new Set(inclusionDiscounts.brands.map((b) => b.id));
      const filtered = brandIds.size > 0
        ? subBrands.filter((sb) => brandIds.has(sb.brandId))
        : subBrands;
      return filtered.filter((sb) => sb.name.toLowerCase().includes(query));
    } else {
      return items.filter(
        (i) =>
          i.name.toLowerCase().includes(query) ||
          i.itemCode.toLowerCase().includes(query)
      );
    }
  };

  const getDiscount = (id: string): number | null => {
    const list =
      inclusionTab === "brands"
        ? inclusionDiscounts.brands
        : inclusionTab === "subbrands"
          ? inclusionDiscounts.subBrands
          : inclusionDiscounts.items;
    const found = list.find((x) => x.id === id);
    return found ? found.discountPercent : null;
  };

  const isIncluded = (id: string) => getDiscount(id) !== null;

  const toggleInclusion = (id: string) => {
    const key =
      inclusionTab === "brands"
        ? "brands"
        : inclusionTab === "subbrands"
          ? "subBrands"
          : "items";
    const list = inclusionDiscounts[key];
    const exists = list.find((x) => x.id === id);
    const updated = exists
      ? list.filter((x) => x.id !== id)
      : [...list, { id, discountPercent: 0 }];
    update({
      inclusionDiscounts: { ...inclusionDiscounts, [key]: updated },
    });
  };

  const updateDiscount = (id: string, discountPercent: number) => {
    const key =
      inclusionTab === "brands"
        ? "brands"
        : inclusionTab === "subbrands"
          ? "subBrands"
          : "items";
    update({
      inclusionDiscounts: {
        ...inclusionDiscounts,
        [key]: inclusionDiscounts[key].map((x) =>
          x.id === id ? { ...x, discountPercent } : x
        ),
      },
    });
  };

  const getInheritedDiscount = (
    itemData: Item | SubBrand
  ): string | null => {
    if (inclusionTab === "items") {
      const item = itemData as Item;
      if (item.subBrandId) {
        const sb = inclusionDiscounts.subBrands.find(
          (x) => x.id === item.subBrandId
        );
        if (sb) {
          const name =
            subBrands.find((s) => s.id === item.subBrandId)?.name || "Sub-brand";
          return `Inherits ${sb.discountPercent}% from ${name}`;
        }
      }
      if (item.brandId) {
        const b = inclusionDiscounts.brands.find(
          (x) => x.id === item.brandId
        );
        if (b) {
          const name =
            brands.find((br) => br.id === item.brandId)?.name || "Brand";
          return `Inherits ${b.discountPercent}% from ${name}`;
        }
      }
    } else if (inclusionTab === "subbrands") {
      const sb = itemData as SubBrand;
      const b = inclusionDiscounts.brands.find((x) => x.id === sb.brandId);
      if (b) {
        const name =
          brands.find((br) => br.id === sb.brandId)?.name || "Brand";
        return `Inherits ${b.discountPercent}% from ${name}`;
      }
    }
    return null;
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
            type="text"
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
              Valid To <span className="text-gray-400">(Optional)</span>
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

        {/* Configure Discounts */}
        <div>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
            onClick={() => setShowInclusionPopup(true)}
          >
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              <span>Configure Discounts</span>
            </div>
            {totalInclusions > 0 ? (
              <span className="bg-teal-100 text-teal-800 text-xs px-2 py-0.5 rounded-full">
                {totalInclusions} configured
              </span>
            ) : (
              <span className="text-gray-400 text-xs">Click to add</span>
            )}
          </Button>
          <p className="text-xs text-gray-500 mt-1">
            Add brands, sub-brands, or items with specific discount percentages
          </p>
        </div>

        {/* Summary */}
        {totalInclusions > 0 && (
          <div className="p-3 bg-gray-50 rounded-lg border text-sm">
            <p className="font-medium text-gray-700 mb-2">
              Configured Discounts:
            </p>
            <div className="space-y-1 text-gray-600">
              {inclusionDiscounts.brands.length > 0 && (
                <p>{inclusionDiscounts.brands.length} brand(s)</p>
              )}
              {inclusionDiscounts.subBrands.length > 0 && (
                <p>{inclusionDiscounts.subBrands.length} sub-brand(s)</p>
              )}
              {inclusionDiscounts.items.length > 0 && (
                <p>{inclusionDiscounts.items.length} item(s)</p>
              )}
            </div>
          </div>
        )}

        {/* Active Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 border rounded-lg">
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

      {/* Inclusion Popup */}
      {showInclusionPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowInclusionPopup(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
              <h3 className="text-lg font-semibold">Configure Discounts</h3>
              <button
                onClick={() => setShowInclusionPopup(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
              {(
                [
                  ["brands", "Brands", inclusionDiscounts.brands.length],
                  ["subbrands", "Sub-Brands", inclusionDiscounts.subBrands.length],
                  ["items", "Items", inclusionDiscounts.items.length],
                ] as [InclusionTab, string, number][]
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setInclusionTab(key);
                    setInclusionSearch("");
                  }}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium ${
                    inclusionTab === key
                      ? "text-teal-600 border-b-2 border-teal-500 bg-teal-50/50"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className="ml-1.5 bg-teal-100 text-teal-700 text-xs px-1.5 py-0.5 rounded-full">
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder={`Search ${inclusionTab}...`}
                  value={inclusionSearch}
                  onChange={(e) => setInclusionSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
              {isLoadingData ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="divide-y">
                  {getFilteredInclusionItems()
                    .slice(0, 100)
                    .map((itemData) => {
                      const id = itemData.id;
                      const included = isIncluded(id);
                      const discount = getDiscount(id);
                      const inheritedInfo = getInheritedDiscount(
                        itemData as Item | SubBrand
                      );

                      return (
                        <div
                          key={id}
                          className={`px-4 py-3 ${included ? "bg-teal-50" : "hover:bg-gray-50"}`}
                        >
                          <div className="flex items-start gap-4">
                            <button
                              type="button"
                              onClick={() => toggleInclusion(id)}
                              className="flex items-start gap-3 text-left flex-1 min-w-0"
                            >
                              <div
                                className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                  included
                                    ? "bg-teal-500 border-teal-500"
                                    : "border-gray-300"
                                }`}
                              >
                                {included && (
                                  <Check className="h-3 w-3 text-white" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm truncate">
                                  {itemData.name}
                                </p>
                                {"itemCode" in itemData && (
                                  <p className="text-xs text-gray-500">
                                    {String((itemData as { itemCode: unknown }).itemCode)}
                                  </p>
                                )}
                                {"brandId" in itemData &&
                                  !("itemCode" in itemData) && (
                                    <p className="text-xs text-gray-500">
                                      {brands.find(
                                        (b) =>
                                          b.id ===
                                          (itemData as SubBrand).brandId
                                      )?.name || ""}
                                    </p>
                                  )}
                                {!included && inheritedInfo && (
                                  <p className="text-xs text-blue-600">
                                    {inheritedInfo}
                                  </p>
                                )}
                              </div>
                            </button>

                            {included && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={discount || 0}
                                  onChange={(e) =>
                                    updateDiscount(
                                      id,
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-20 h-8 text-sm text-right"
                                  onClick={(e) => e.stopPropagation()}
                                  onFocus={(e) => e.target.select()}
                                />
                                <span className="text-sm text-gray-500 font-medium">
                                  %
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  {getFilteredInclusionItems().length === 0 && (
                    <p className="text-center text-gray-500 py-8 text-sm">
                      No {inclusionTab} found
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t px-4 py-3 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {totalInclusions} total configured
                </p>
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
