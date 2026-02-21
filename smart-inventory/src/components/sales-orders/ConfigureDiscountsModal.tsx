"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Search, Check } from "lucide-react";

interface Item {
  id: string;
  itemCode: string;
  name: string;
  unit: string;
  brandId?: string | null;
  subBrandId?: string | null;
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

type InclusionTab = "brands" | "subbrands" | "items";

interface ConfigureDiscountsModalProps {
  open: boolean;
  onClose: () => void;
  discounts: InclusionDiscounts;
  onSave: (discounts: InclusionDiscounts) => void;
  brands: Brand[];
  subBrands: SubBrand[];
  items: Item[];
}

export function ConfigureDiscountsModal({
  open,
  onClose,
  discounts,
  onSave,
  brands,
  subBrands,
  items,
}: ConfigureDiscountsModalProps) {
  const [localDiscounts, setLocalDiscounts] = useState<InclusionDiscounts>(discounts);
  const [activeTab, setActiveTab] = useState<InclusionTab>("brands");
  const [search, setSearch] = useState("");

  // Reset local state when modal opens with new discounts
  const [prevDiscounts, setPrevDiscounts] = useState(discounts);
  if (discounts !== prevDiscounts) {
    setPrevDiscounts(discounts);
    setLocalDiscounts(discounts);
  }

  if (!open) return null;

  const totalInclusions =
    localDiscounts.brands.length +
    localDiscounts.subBrands.length +
    localDiscounts.items.length;

  const getFilteredItems = () => {
    const query = search.toLowerCase();

    if (activeTab === "brands") {
      return brands.filter((b) => b.name.toLowerCase().includes(query));
    } else if (activeTab === "subbrands") {
      const brandIdsWithDiscount = new Set(localDiscounts.brands.map((b) => b.id));
      const filteredSubBrands =
        brandIdsWithDiscount.size > 0
          ? subBrands.filter((sb) => brandIdsWithDiscount.has(sb.brandId))
          : subBrands;
      return filteredSubBrands.filter((sb) => sb.name.toLowerCase().includes(query));
    } else {
      return items.filter(
        (i) =>
          i.name.toLowerCase().includes(query) ||
          i.itemCode.toLowerCase().includes(query)
      );
    }
  };

  const getDiscount = (id: string): number | null => {
    if (activeTab === "brands") {
      const found = localDiscounts.brands.find((b) => b.id === id);
      return found ? found.discountPercent : null;
    } else if (activeTab === "subbrands") {
      const found = localDiscounts.subBrands.find((sb) => sb.id === id);
      return found ? found.discountPercent : null;
    } else {
      const found = localDiscounts.items.find((i) => i.id === id);
      return found ? found.discountPercent : null;
    }
  };

  const isIncluded = (id: string): boolean => {
    return getDiscount(id) !== null;
  };

  const toggleInclusion = (id: string) => {
    if (activeTab === "brands") {
      setLocalDiscounts((prev) => {
        const existing = prev.brands.find((b) => b.id === id);
        if (existing) {
          return { ...prev, brands: prev.brands.filter((b) => b.id !== id) };
        } else {
          return { ...prev, brands: [...prev.brands, { id, discountPercent: 0 }] };
        }
      });
    } else if (activeTab === "subbrands") {
      setLocalDiscounts((prev) => {
        const existing = prev.subBrands.find((sb) => sb.id === id);
        if (existing) {
          return { ...prev, subBrands: prev.subBrands.filter((sb) => sb.id !== id) };
        } else {
          return { ...prev, subBrands: [...prev.subBrands, { id, discountPercent: 0 }] };
        }
      });
    } else {
      setLocalDiscounts((prev) => {
        const existing = prev.items.find((i) => i.id === id);
        if (existing) {
          return { ...prev, items: prev.items.filter((i) => i.id !== id) };
        } else {
          return { ...prev, items: [...prev.items, { id, discountPercent: 0 }] };
        }
      });
    }
  };

  const updateDiscount = (id: string, discountPercent: number) => {
    if (activeTab === "brands") {
      setLocalDiscounts((prev) => ({
        ...prev,
        brands: prev.brands.map((b) => (b.id === id ? { ...b, discountPercent } : b)),
      }));
    } else if (activeTab === "subbrands") {
      setLocalDiscounts((prev) => ({
        ...prev,
        subBrands: prev.subBrands.map((sb) =>
          sb.id === id ? { ...sb, discountPercent } : sb
        ),
      }));
    } else {
      setLocalDiscounts((prev) => ({
        ...prev,
        items: prev.items.map((i) => (i.id === id ? { ...i, discountPercent } : i)),
      }));
    }
  };

  const getInheritedDiscount = (itemData: Item | SubBrand): string | null => {
    if (activeTab === "items") {
      const item = itemData as Item;
      if (item.subBrandId) {
        const subBrand = localDiscounts.subBrands.find((sb) => sb.id === item.subBrandId);
        if (subBrand) {
          const sbName = subBrands.find((s) => s.id === item.subBrandId)?.name || "Sub-brand";
          return `Inherits ${subBrand.discountPercent}% from ${sbName}`;
        }
      }
      if (item.brandId) {
        const brand = localDiscounts.brands.find((b) => b.id === item.brandId);
        if (brand) {
          const brandName = brands.find((b) => b.id === item.brandId)?.name || "Brand";
          return `Inherits ${brand.discountPercent}% from ${brandName}`;
        }
      }
    } else if (activeTab === "subbrands") {
      const subBrand = itemData as SubBrand;
      const brand = localDiscounts.brands.find((b) => b.id === subBrand.brandId);
      if (brand) {
        const brandName = brands.find((b) => b.id === subBrand.brandId)?.name || "Brand";
        return `Inherits ${brand.discountPercent}% from ${brandName}`;
      }
    }
    return null;
  };

  const handleDone = () => {
    onSave(localDiscounts);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <h3 className="text-lg font-semibold">Configure Discounts</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            type="button"
            onClick={() => { setActiveTab("brands"); setSearch(""); }}
            className={`flex-1 px-4 py-2.5 text-sm font-medium ${
              activeTab === "brands"
                ? "text-teal-600 border-b-2 border-teal-500 bg-teal-50/50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Brands
            {localDiscounts.brands.length > 0 && (
              <span className="ml-1.5 bg-teal-100 text-teal-700 text-xs px-1.5 py-0.5 rounded-full">
                {localDiscounts.brands.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("subbrands"); setSearch(""); }}
            className={`flex-1 px-4 py-2.5 text-sm font-medium ${
              activeTab === "subbrands"
                ? "text-teal-600 border-b-2 border-teal-500 bg-teal-50/50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Sub-Brands
            {localDiscounts.subBrands.length > 0 && (
              <span className="ml-1.5 bg-teal-100 text-teal-700 text-xs px-1.5 py-0.5 rounded-full">
                {localDiscounts.subBrands.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("items"); setSearch(""); }}
            className={`flex-1 px-4 py-2.5 text-sm font-medium ${
              activeTab === "items"
                ? "text-teal-600 border-b-2 border-teal-500 bg-teal-50/50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Items
            {localDiscounts.items.length > 0 && (
              <span className="ml-1.5 bg-teal-100 text-teal-700 text-xs px-1.5 py-0.5 rounded-full">
                {localDiscounts.items.length}
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="divide-y">
            {getFilteredItems().slice(0, 100).map((itemData: Brand | SubBrand | Item) => {
              const id = itemData.id;
              const included = isIncluded(id);
              const discount = getDiscount(id);
              const inheritedInfo = getInheritedDiscount(itemData as Item | SubBrand);

              return (
                <div
                  key={id}
                  className={`px-4 py-3 border-b last:border-b-0 ${
                    included ? "bg-teal-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <button
                      type="button"
                      onClick={() => toggleInclusion(id)}
                      className="flex items-start gap-3 text-left flex-1 min-w-0"
                    >
                      <div
                        className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          included ? "bg-teal-500 border-teal-500" : "border-gray-300"
                        }`}
                      >
                        {included && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{itemData.name}</p>
                        {"itemCode" in itemData && (
                          <p className="text-xs text-gray-500">{itemData.itemCode}</p>
                        )}
                        {"brandId" in itemData && "name" in itemData && !("itemCode" in itemData) && (
                          <p className="text-xs text-gray-500">
                            {brands.find((b) => b.id === (itemData as SubBrand).brandId)?.name || ""}
                          </p>
                        )}
                        {!included && inheritedInfo && (
                          <p className="text-xs text-blue-600">{inheritedInfo}</p>
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
                          onChange={(e) => updateDiscount(id, parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 text-sm text-right"
                          onClick={(e) => e.stopPropagation()}
                          onFocus={(e) => e.target.select()}
                          placeholder="0.00"
                        />
                        <span className="text-sm text-gray-500 font-medium">%</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {getFilteredItems().length === 0 && (
              <p className="text-center text-gray-500 py-8 text-sm">
                No {activeTab} found
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">{totalInclusions} total configured</p>
            <Button
              type="button"
              onClick={handleDone}
              className="bg-teal-500 hover:bg-teal-600 text-white"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
