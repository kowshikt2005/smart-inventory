"use client";

import { useState, useEffect } from "react";
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

interface RateSheet {
  id: string;
  name: string;
  customerId: string;
  validFrom: string;
  validTo: string | null;
  discountPercent: number;
  isActive: boolean;
  customer: Customer;
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

type InclusionTab = "brands" | "subbrands" | "items";

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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Data for inclusions
  const [items, setItems] = useState<Item[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [subBrands, setSubBrands] = useState<SubBrand[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Inclusion discounts (new model)
  const [inclusionDiscounts, setInclusionDiscounts] = useState<InclusionDiscounts>({
    brands: [],
    subBrands: [],
    items: [],
  });


  // Inclusion popup
  const [showInclusionPopup, setShowInclusionPopup] = useState(false);
  const [inclusionTab, setInclusionTab] = useState<InclusionTab>("brands");
  const [inclusionSearch, setInclusionSearch] = useState("");

  // Form fields
  const [name, setName] = useState("");
  const [validFrom, setValidFrom] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [validTo, setValidTo] = useState("");
  const [isActive, setIsActive] = useState(true);

  const isEditing = !!editingRateSheet;

  // Fetch data
  useEffect(() => {
    if (isOpen) {
      if (!isEditing) {
        fetchCustomers();
      }
      fetchData();
    }
  }, [isOpen, isEditing]);

  // Pre-fill form when editing
  useEffect(() => {
    if (editingRateSheet) {
      setName(editingRateSheet.name);
      setSelectedCustomer(editingRateSheet.customer);
      setValidFrom(editingRateSheet.validFrom.split("T")[0]);
      setValidTo(
        editingRateSheet.validTo
          ? editingRateSheet.validTo.split("T")[0]
          : ""
      );
      setIsActive(editingRateSheet.isActive);

      // Load inclusion discounts
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
    try {
      setIsLoadingCustomers(true);
      const response = await fetch("/api/customers?limit=500");
      if (response.ok) {
        const data = await response.json();
        setCustomers(data.customers || []);
      }
    } catch (err) {
      console.error("Error fetching customers:", err);
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const fetchData = async () => {
    try {
      setIsLoadingData(true);
      const [itemsRes, brandsRes, subBrandsRes] = await Promise.all([
        fetch("/api/items?limit=1000&activeOnly=true"),
        fetch("/api/brands?limit=500"),
        fetch("/api/sub-brands?limit=500"),
      ]);

      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setItems(data.items || []);
      }
      if (brandsRes.ok) {
        const data = await brandsRes.json();
        setBrands(data.brands || []);
      }
      if (subBrandsRes.ok) {
        const data = await subBrandsRes.json();
        setSubBrands(data.subBrands || []);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setIsLoadingData(false);
    }
  };

  const resetForm = () => {
    setName("");
    setSelectedCustomer(null);
    setCustomerSearch("");
    setValidFrom(new Date().toISOString().split("T")[0]);
    setValidTo("");
    setIsActive(true);
    setInclusionDiscounts({ brands: [], subBrands: [], items: [] });
    setError(null);
    setShowInclusionPopup(false);
    setInclusionSearch("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Filter customers based on search
  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.customerNumber.toLowerCase().includes(customerSearch.toLowerCase())
  );

  // Auto-generate name when customer is selected
  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch("");
    if (!name || name === "") {
      setName(`${customer.name} - Rate Sheet`);
    }
  };

  // Get total inclusion count
  const totalInclusions = inclusionDiscounts.brands.length + inclusionDiscounts.subBrands.length + inclusionDiscounts.items.length;

  // Get filtered inclusion items based on tab and search
  // Smart filtering: sub-brands are filtered to only show those belonging to brands with configured discounts
  const getFilteredInclusionItems = () => {
    const query = inclusionSearch.toLowerCase();

    if (inclusionTab === "brands") {
      return brands.filter(b => b.name.toLowerCase().includes(query));
    } else if (inclusionTab === "subbrands") {
      // Get brand IDs that have discounts configured
      const brandIdsWithDiscount = new Set(inclusionDiscounts.brands.map(b => b.id));

      // Filter sub-brands: only show those belonging to brands with configured discounts
      // If no brands have discounts yet, show all sub-brands
      const filteredSubBrands = brandIdsWithDiscount.size > 0
        ? subBrands.filter(sb => brandIdsWithDiscount.has(sb.brandId))
        : subBrands;

      return filteredSubBrands.filter(sb => sb.name.toLowerCase().includes(query));
    } else {
      // Items tab shows all items regardless of brand/sub-brand filtering
      return items.filter(i =>
        i.name.toLowerCase().includes(query) ||
        i.itemCode.toLowerCase().includes(query)
      );
    }
  };

  // Get discount for an item
  const getDiscount = (id: string): number | null => {
    if (inclusionTab === "brands") {
      const found = inclusionDiscounts.brands.find(b => b.id === id);
      return found ? found.discountPercent : null;
    } else if (inclusionTab === "subbrands") {
      const found = inclusionDiscounts.subBrands.find(sb => sb.id === id);
      return found ? found.discountPercent : null;
    } else {
      const found = inclusionDiscounts.items.find(i => i.id === id);
      return found ? found.discountPercent : null;
    }
  };

  // Check if included
  const isIncluded = (id: string): boolean => {
    return getDiscount(id) !== null;
  };

  // Toggle inclusion with 0% default discount
  const toggleInclusion = (id: string) => {
    const discount = 0;

    if (inclusionTab === "brands") {
      setInclusionDiscounts(prev => {
        const existing = prev.brands.find(b => b.id === id);
        if (existing) {
          return { ...prev, brands: prev.brands.filter(b => b.id !== id) };
        } else {
          return { ...prev, brands: [...prev.brands, { id, discountPercent: discount }] };
        }
      });
    } else if (inclusionTab === "subbrands") {
      setInclusionDiscounts(prev => {
        const existing = prev.subBrands.find(sb => sb.id === id);
        if (existing) {
          return { ...prev, subBrands: prev.subBrands.filter(sb => sb.id !== id) };
        } else {
          return { ...prev, subBrands: [...prev.subBrands, { id, discountPercent: discount }] };
        }
      });
    } else {
      setInclusionDiscounts(prev => {
        const existing = prev.items.find(i => i.id === id);
        if (existing) {
          return { ...prev, items: prev.items.filter(i => i.id !== id) };
        } else {
          return { ...prev, items: [...prev.items, { id, discountPercent: discount }] };
        }
      });
    }
  };

  // Update discount for an item
  const updateDiscount = (id: string, discountPercent: number) => {
    if (inclusionTab === "brands") {
      setInclusionDiscounts(prev => ({
        ...prev,
        brands: prev.brands.map(b => b.id === id ? { ...b, discountPercent } : b),
      }));
    } else if (inclusionTab === "subbrands") {
      setInclusionDiscounts(prev => ({
        ...prev,
        subBrands: prev.subBrands.map(sb => sb.id === id ? { ...sb, discountPercent } : sb),
      }));
    } else {
      setInclusionDiscounts(prev => ({
        ...prev,
        items: prev.items.map(i => i.id === id ? { ...i, discountPercent } : i),
      }));
    }
  };

  // Get inherited discount info for display
  const getInheritedDiscount = (itemData: Item | SubBrand): string | null => {
    if (inclusionTab === "items") {
      const item = itemData as Item;
      // Check sub-brand first
      if (item.subBrandId) {
        const subBrand = inclusionDiscounts.subBrands.find(sb => sb.id === item.subBrandId);
        if (subBrand) {
          const sbName = subBrands.find(s => s.id === item.subBrandId)?.name || "Sub-brand";
          return `Inherits ${subBrand.discountPercent}% from ${sbName}`;
        }
      }
      // Check brand
      if (item.brandId) {
        const brand = inclusionDiscounts.brands.find(b => b.id === item.brandId);
        if (brand) {
          const brandName = brands.find(b => b.id === item.brandId)?.name || "Brand";
          return `Inherits ${brand.discountPercent}% from ${brandName}`;
        }
      }
    } else if (inclusionTab === "subbrands") {
      const subBrand = itemData as SubBrand;
      // Check brand
      const brand = inclusionDiscounts.brands.find(b => b.id === subBrand.brandId);
      if (brand) {
        const brandName = brands.find(b => b.id === subBrand.brandId)?.name || "Brand";
        return `Inherits ${brand.discountPercent}% from ${brandName}`;
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError("Please enter a name for the rate sheet");
      return;
    }

    if (!selectedCustomer) {
      setError("Please select a customer");
      return;
    }

    if (!validFrom) {
      setError("Please enter a valid from date");
      return;
    }

    if (totalInclusions === 0) {
      setError("Please add at least one brand, sub-brand, or item to the rate sheet");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        customerId: selectedCustomer.id,
        validFrom,
        validTo: validTo || null,
        discountPercent: 0, // Legacy field - not used in inclusion model
        isActive,
        useInclusionModel: true,
        inclusionDiscounts,
        // Clear exclusion fields when using inclusion model
        excludedItemIds: [],
        excludedBrandIds: [],
        excludedSubBrandIds: [],
      };

      const url = isEditing
        ? `/api/rate-sheets/${editingRateSheet.id}`
        : "/api/rate-sheets";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save rate sheet");
      }

      onSuccess();
      handleClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing ? "Edit Rate Sheet" : "New Rate Sheet"}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-5">
            {/* Rate Sheet Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Premium Customer Rate"
                className="w-full"
              />
            </div>

            {/* Customer Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Customer <span className="text-red-500">*</span>
              </label>
              {isEditing ? (
                <div className="p-3 bg-gray-50 border rounded-lg">
                  <p className="font-medium">{selectedCustomer?.name}</p>
                  <p className="text-xs text-gray-500">
                    {selectedCustomer?.customerNumber}
                  </p>
                </div>
              ) : isLoadingCustomers ? (
                <div className="flex items-center gap-2 text-gray-500 p-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading customers...
                </div>
              ) : (
                <div className="space-y-2">
                  {!selectedCustomer && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search customers..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  )}
                  {customerSearch && !selectedCustomer && (
                    <div className="border rounded-lg max-h-40 overflow-y-auto">
                      {filteredCustomers.length === 0 ? (
                        <p className="p-3 text-gray-500 text-sm">No customers found</p>
                      ) : (
                        filteredCustomers.slice(0, 10).map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => handleCustomerSelect(customer)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0"
                          >
                            <p className="font-medium">{customer.name}</p>
                            <p className="text-xs text-gray-500">
                              {customer.customerNumber}
                              {customer.gstin && ` | ${customer.gstin}`}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  {selectedCustomer && (
                    <div className="flex items-center justify-between p-3 bg-teal-50 border border-teal-200 rounded-lg">
                      <div>
                        <p className="font-medium text-teal-900">
                          {selectedCustomer.name}
                        </p>
                        <p className="text-xs text-teal-700">
                          {selectedCustomer.customerNumber}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCustomer(null)}
                        className="text-teal-600 hover:text-teal-800"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Validity Dates */}
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
                  Valid To <span className="text-gray-400">(Optional)</span>
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

            {/* Inclusions Button */}
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
                  <span className="text-gray-400 text-xs">
                    Click to add
                  </span>
                )}
              </Button>
              <p className="text-xs text-gray-500 mt-1">
                Add brands, sub-brands, or items with specific discount percentages
              </p>
            </div>

            {/* Summary of inclusions */}
            {totalInclusions > 0 && (
              <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                <p className="font-medium text-gray-700 mb-2">Configured Discounts:</p>
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
                  {isActive
                    ? "Discounts will be applied to orders"
                    : "Discounts will NOT be applied"}
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                className="data-[state=checked]:bg-teal-500"
              />
            </div>
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

      {/* Inclusion Popup */}
      {showInclusionPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowInclusionPopup(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            {/* Popup Header */}
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
              <button
                type="button"
                onClick={() => { setInclusionTab("brands"); setInclusionSearch(""); }}
                className={`flex-1 px-4 py-2.5 text-sm font-medium ${
                  inclusionTab === "brands"
                    ? "text-teal-600 border-b-2 border-teal-500 bg-teal-50/50"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Brands
                {inclusionDiscounts.brands.length > 0 && (
                  <span className="ml-1.5 bg-teal-100 text-teal-700 text-xs px-1.5 py-0.5 rounded-full">
                    {inclusionDiscounts.brands.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setInclusionTab("subbrands"); setInclusionSearch(""); }}
                className={`flex-1 px-4 py-2.5 text-sm font-medium ${
                  inclusionTab === "subbrands"
                    ? "text-teal-600 border-b-2 border-teal-500 bg-teal-50/50"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Sub-Brands
                {inclusionDiscounts.subBrands.length > 0 && (
                  <span className="ml-1.5 bg-teal-100 text-teal-700 text-xs px-1.5 py-0.5 rounded-full">
                    {inclusionDiscounts.subBrands.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setInclusionTab("items"); setInclusionSearch(""); }}
                className={`flex-1 px-4 py-2.5 text-sm font-medium ${
                  inclusionTab === "items"
                    ? "text-teal-600 border-b-2 border-teal-500 bg-teal-50/50"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Items
                {inclusionDiscounts.items.length > 0 && (
                  <span className="ml-1.5 bg-teal-100 text-teal-700 text-xs px-1.5 py-0.5 rounded-full">
                    {inclusionDiscounts.items.length}
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
                  {getFilteredInclusionItems().slice(0, 100).map((itemData: Brand | SubBrand | Item) => {
                    const id = itemData.id;
                    const included = isIncluded(id);
                    const discount = getDiscount(id);
                    const inheritedInfo = getInheritedDiscount(itemData as Item | SubBrand);

                    return (
                      <div
                        key={id}
                        className={`px-4 py-3 border-b last:border-b-0 ${included ? "bg-teal-50" : "hover:bg-gray-50"}`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Checkbox and Name */}
                          <button
                            type="button"
                            onClick={() => toggleInclusion(id)}
                            className="flex items-start gap-3 text-left flex-1 min-w-0"
                          >
                            <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                              included
                                ? "bg-teal-500 border-teal-500"
                                : "border-gray-300"
                            }`}>
                              {included && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">
                                {itemData.name}
                              </p>
                              {"itemCode" in itemData && (
                                <p className="text-xs text-gray-500">{itemData.itemCode}</p>
                              )}
                              {"brandId" in itemData && "name" in itemData && !("itemCode" in itemData) && (
                                <p className="text-xs text-gray-500">
                                  {brands.find(b => b.id === (itemData as SubBrand).brandId)?.name || ""}
                                </p>
                              )}
                              {!included && inheritedInfo && (
                                <p className="text-xs text-blue-600">{inheritedInfo}</p>
                              )}
                            </div>
                          </button>

                          {/* Discount Controls */}
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
                  {getFilteredInclusionItems().length === 0 && (
                    <p className="text-center text-gray-500 py-8 text-sm">
                      No {inclusionTab} found
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Popup Footer */}
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
    </div>
  );
}
