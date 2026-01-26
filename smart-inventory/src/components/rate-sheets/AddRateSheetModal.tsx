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
  Percent,
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

interface RateSheet {
  id: string;
  name: string;
  customerId: string;
  validFrom: string;
  validTo: string | null;
  discountPercent: number;
  isActive: boolean;
  customer: Customer;
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

type ExclusionTab = "brands" | "subbrands" | "items";

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

  // Data for exclusions
  const [items, setItems] = useState<Item[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [subBrands, setSubBrands] = useState<SubBrand[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Exclusions
  const [excludedItemIds, setExcludedItemIds] = useState<string[]>([]);
  const [excludedBrandIds, setExcludedBrandIds] = useState<string[]>([]);
  const [excludedSubBrandIds, setExcludedSubBrandIds] = useState<string[]>([]);

  // Exclusion popup
  const [showExclusionPopup, setShowExclusionPopup] = useState(false);
  const [exclusionTab, setExclusionTab] = useState<ExclusionTab>("brands");
  const [exclusionSearch, setExclusionSearch] = useState("");

  // Form fields
  const [name, setName] = useState("");
  const [validFrom, setValidFrom] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [validTo, setValidTo] = useState("");
  const [discountPercent, setDiscountPercent] = useState("0");
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
      setDiscountPercent(String(editingRateSheet.discountPercent));
      setIsActive(editingRateSheet.isActive);
      setExcludedItemIds(Array.isArray(editingRateSheet.excludedItemIds) ? editingRateSheet.excludedItemIds : []);
      setExcludedBrandIds(Array.isArray(editingRateSheet.excludedBrandIds) ? editingRateSheet.excludedBrandIds : []);
      setExcludedSubBrandIds(Array.isArray(editingRateSheet.excludedSubBrandIds) ? editingRateSheet.excludedSubBrandIds : []);
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
    setDiscountPercent("0");
    setIsActive(true);
    setExcludedItemIds([]);
    setExcludedBrandIds([]);
    setExcludedSubBrandIds([]);
    setError(null);
    setShowExclusionPopup(false);
    setExclusionSearch("");
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

  // Get total exclusion count
  const totalExclusions = excludedBrandIds.length + excludedSubBrandIds.length + excludedItemIds.length;

  // Get filtered exclusion items based on tab and search
  const getFilteredExclusionItems = () => {
    const query = exclusionSearch.toLowerCase();

    if (exclusionTab === "brands") {
      return brands.filter(b => b.name.toLowerCase().includes(query));
    } else if (exclusionTab === "subbrands") {
      return subBrands.filter(sb => sb.name.toLowerCase().includes(query));
    } else {
      return items.filter(i =>
        i.name.toLowerCase().includes(query) ||
        i.itemCode.toLowerCase().includes(query)
      );
    }
  };

  // Toggle exclusion
  const toggleExclusion = (id: string) => {
    if (exclusionTab === "brands") {
      setExcludedBrandIds(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
    } else if (exclusionTab === "subbrands") {
      setExcludedSubBrandIds(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
    } else {
      setExcludedItemIds(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
    }
  };

  // Check if item is excluded
  const isExcluded = (id: string) => {
    if (exclusionTab === "brands") return excludedBrandIds.includes(id);
    if (exclusionTab === "subbrands") return excludedSubBrandIds.includes(id);
    return excludedItemIds.includes(id);
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

    const discount = parseFloat(discountPercent);
    if (isNaN(discount) || discount < 0 || discount > 100) {
      setError("Discount percent must be between 0 and 100");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        customerId: selectedCustomer.id,
        validFrom,
        validTo: validTo || null,
        discountPercent: discount,
        isActive,
        excludedItemIds,
        excludedBrandIds,
        excludedSubBrandIds,
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

            {/* Discount Percentage - Main Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Discount Percentage <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  className="pl-10 text-lg font-semibold"
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                e.g., 10% discount means customer pays 90% of base price
              </p>
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

            {/* Exclusions Button */}
            <div>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between"
                onClick={() => setShowExclusionPopup(true)}
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  <span>Configure Exclusions</span>
                </div>
                {totalExclusions > 0 && (
                  <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full">
                    {totalExclusions} excluded
                  </span>
                )}
              </Button>
              <p className="text-xs text-gray-500 mt-1">
                Exclude specific brands, sub-brands, or items from this rate sheet
              </p>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 border rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Active</p>
                <p className="text-sm text-gray-500">
                  {isActive
                    ? "Discount will be applied to orders"
                    : "Discount will NOT be applied"}
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

      {/* Exclusion Popup */}
      {showExclusionPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowExclusionPopup(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden">
            {/* Popup Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
              <h3 className="text-lg font-semibold">Configure Exclusions</h3>
              <button
                onClick={() => setShowExclusionPopup(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
              <button
                type="button"
                onClick={() => { setExclusionTab("brands"); setExclusionSearch(""); }}
                className={`flex-1 px-4 py-2.5 text-sm font-medium ${
                  exclusionTab === "brands"
                    ? "text-teal-600 border-b-2 border-teal-500 bg-teal-50/50"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Brands
                {excludedBrandIds.length > 0 && (
                  <span className="ml-1.5 bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">
                    {excludedBrandIds.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setExclusionTab("subbrands"); setExclusionSearch(""); }}
                className={`flex-1 px-4 py-2.5 text-sm font-medium ${
                  exclusionTab === "subbrands"
                    ? "text-teal-600 border-b-2 border-teal-500 bg-teal-50/50"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Sub-Brands
                {excludedSubBrandIds.length > 0 && (
                  <span className="ml-1.5 bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">
                    {excludedSubBrandIds.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setExclusionTab("items"); setExclusionSearch(""); }}
                className={`flex-1 px-4 py-2.5 text-sm font-medium ${
                  exclusionTab === "items"
                    ? "text-teal-600 border-b-2 border-teal-500 bg-teal-50/50"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Items
                {excludedItemIds.length > 0 && (
                  <span className="ml-1.5 bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">
                    {excludedItemIds.length}
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
                  placeholder={`Search ${exclusionTab}...`}
                  value={exclusionSearch}
                  onChange={(e) => setExclusionSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-[400px]">
              {isLoadingData ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="divide-y">
                  {getFilteredExclusionItems().slice(0, 100).map((item: Brand | SubBrand | Item) => {
                    const id = item.id;
                    const excluded = isExcluded(id);

                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleExclusion(id)}
                        className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors ${
                          excluded ? "bg-amber-50" : ""
                        }`}
                      >
                        <div className="text-left">
                          <p className="font-medium text-sm">
                            {item.name}
                          </p>
                          {"itemCode" in item && (
                            <p className="text-xs text-gray-500">{item.itemCode}</p>
                          )}
                          {"brandId" in item && item.brandId && (
                            <p className="text-xs text-gray-500">
                              {brands.find(b => b.id === item.brandId)?.name || ""}
                            </p>
                          )}
                        </div>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          excluded
                            ? "bg-amber-500 border-amber-500"
                            : "border-gray-300"
                        }`}>
                          {excluded && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                  {getFilteredExclusionItems().length === 0 && (
                    <p className="text-center text-gray-500 py-8 text-sm">
                      No {exclusionTab} found
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Popup Footer */}
            <div className="border-t px-4 py-3 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {totalExclusions} total exclusions
                </p>
                <Button
                  type="button"
                  onClick={() => setShowExclusionPopup(false)}
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
