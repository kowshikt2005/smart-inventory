"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  X,
  Loader2,
  Search,
  Calendar,
  Percent,
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
  itemRatePercent: number;
  discountPercent: number;
  taxType: string;
  currency: string;
  roundOff: string;
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

const CURRENCIES = [
  { value: "INR", label: "INR - Indian Rupee" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "AED", label: "AED - UAE Dirham" },
];

const ROUND_OFF_OPTIONS = [
  { value: "NONE", label: "None" },
  { value: "UP", label: "Round Up" },
  { value: "DOWN", label: "Round Down" },
  { value: "NEAREST", label: "Nearest" },
];

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

  // Items data for exclusions
  const [items, setItems] = useState<Item[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [excludedItemIds, setExcludedItemIds] = useState<string[]>([]);
  const [itemSearch, setItemSearch] = useState("");

  // Brands data for exclusions
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);
  const [excludedBrandIds, setExcludedBrandIds] = useState<string[]>([]);
  const [brandSearch, setBrandSearch] = useState("");

  // Sub-brands data for exclusions
  const [subBrands, setSubBrands] = useState<SubBrand[]>([]);
  const [isLoadingSubBrands, setIsLoadingSubBrands] = useState(false);
  const [excludedSubBrandIds, setExcludedSubBrandIds] = useState<string[]>([]);
  const [subBrandSearch, setSubBrandSearch] = useState("");

  // Form fields
  const [name, setName] = useState("");
  const [validFrom, setValidFrom] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [validTo, setValidTo] = useState("");
  const [itemRatePercent, setItemRatePercent] = useState("100");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [taxType, setTaxType] = useState("INCLUSIVE");
  const [currency, setCurrency] = useState("INR");
  const [roundOff, setRoundOff] = useState("NONE");
  const [isActive, setIsActive] = useState(true);

  const isEditing = !!editingRateSheet;

  // Fetch customers, items, brands, and sub-brands
  useEffect(() => {
    if (isOpen) {
      if (!isEditing) {
        fetchCustomers();
      }
      fetchItems();
      fetchBrands();
      fetchSubBrands();
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
      setItemRatePercent(String(editingRateSheet.itemRatePercent));
      setDiscountPercent(String(editingRateSheet.discountPercent));
      setTaxType(editingRateSheet.taxType || "INCLUSIVE");
      setCurrency(editingRateSheet.currency);
      setRoundOff(editingRateSheet.roundOff);
      setIsActive(editingRateSheet.isActive);
      const excludedItems = editingRateSheet.excludedItemIds || [];
      setExcludedItemIds(Array.isArray(excludedItems) ? excludedItems : []);
      const excludedBrands = editingRateSheet.excludedBrandIds || [];
      setExcludedBrandIds(Array.isArray(excludedBrands) ? excludedBrands : []);
      const excludedSubBrands = editingRateSheet.excludedSubBrandIds || [];
      setExcludedSubBrandIds(Array.isArray(excludedSubBrands) ? excludedSubBrands : []);
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

  const fetchItems = async () => {
    try {
      setIsLoadingItems(true);
      const response = await fetch("/api/items?limit=1000&activeOnly=true");
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Error fetching items:", err);
    } finally {
      setIsLoadingItems(false);
    }
  };

  const fetchBrands = async () => {
    try {
      setIsLoadingBrands(true);
      const response = await fetch("/api/brands?limit=500");
      if (response.ok) {
        const data = await response.json();
        setBrands(data.brands || []);
      }
    } catch (err) {
      console.error("Error fetching brands:", err);
    } finally {
      setIsLoadingBrands(false);
    }
  };

  const fetchSubBrands = async () => {
    try {
      setIsLoadingSubBrands(true);
      const response = await fetch("/api/sub-brands?limit=500");
      if (response.ok) {
        const data = await response.json();
        setSubBrands(data.subBrands || []);
      }
    } catch (err) {
      console.error("Error fetching sub-brands:", err);
    } finally {
      setIsLoadingSubBrands(false);
    }
  };

  const resetForm = () => {
    setName("");
    setSelectedCustomer(null);
    setCustomerSearch("");
    setValidFrom(new Date().toISOString().split("T")[0]);
    setValidTo("");
    setItemRatePercent("100");
    setDiscountPercent("0");
    setTaxType("INCLUSIVE");
    setCurrency("INR");
    setRoundOff("NONE");
    setIsActive(true);
    setExcludedItemIds([]);
    setExcludedBrandIds([]);
    setExcludedSubBrandIds([]);
    setItemSearch("");
    setBrandSearch("");
    setSubBrandSearch("");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Filter customers based on search (exclude customers who already have rate sheets)
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

    const ratePercent = parseFloat(itemRatePercent);
    if (isNaN(ratePercent) || ratePercent < 0 || ratePercent > 200) {
      setError("Item rate percent must be between 0 and 200");
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
        itemRatePercent: ratePercent,
        discountPercent: discount,
        taxType,
        currency,
        roundOff,
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
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
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

          <div className="space-y-6">
            {/* Rate Sheet Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Premium Customer Rate Sheet"
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                A descriptive name for this rate sheet
              </p>
            </div>

            {/* Customer Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Applicable to Customer <span className="text-red-500">*</span>
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
                              {customer.gstin && ` • ${customer.gstin}`}
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
                          {selectedCustomer.gstin && ` • ${selectedCustomer.gstin}`}
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

            {/* Exclusions Section */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Exclude from Discount <span className="text-gray-400">(Optional)</span>
              </label>

              {/* Excluded Brands */}
              <div className="border rounded-lg p-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Brands</p>
                {isLoadingBrands ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search brands..."
                        value={brandSearch}
                        onChange={(e) => setBrandSearch(e.target.value)}
                        className="pl-10 h-9 text-sm"
                      />
                    </div>
                    {excludedBrandIds.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {excludedBrandIds.map((id) => {
                          const brand = brands.find((b) => b.id === id);
                          if (!brand) return null;
                          return (
                            <div
                              key={id}
                              className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs"
                            >
                              <span>{brand.name}</span>
                              <button
                                type="button"
                                onClick={() => setExcludedBrandIds((prev) => prev.filter((i) => i !== id))}
                                className="text-amber-600 hover:text-amber-800"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {brandSearch && (
                      <div className="border rounded-lg max-h-32 overflow-y-auto">
                        {brands
                          .filter((b) => b.name.toLowerCase().includes(brandSearch.toLowerCase()) && !excludedBrandIds.includes(b.id))
                          .slice(0, 10)
                          .map((brand) => (
                            <button
                              key={brand.id}
                              type="button"
                              onClick={() => {
                                setExcludedBrandIds((prev) => [...prev, brand.id]);
                                setBrandSearch("");
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0 text-sm"
                            >
                              {brand.name}
                            </button>
                          ))}
                        {brands.filter((b) => b.name.toLowerCase().includes(brandSearch.toLowerCase()) && !excludedBrandIds.includes(b.id)).length === 0 && (
                          <p className="p-2 text-gray-500 text-xs">No brands found</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Excluded Sub-Brands */}
              <div className="border rounded-lg p-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Sub-Brands</p>
                {isLoadingSubBrands ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search sub-brands..."
                        value={subBrandSearch}
                        onChange={(e) => setSubBrandSearch(e.target.value)}
                        className="pl-10 h-9 text-sm"
                      />
                    </div>
                    {excludedSubBrandIds.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {excludedSubBrandIds.map((id) => {
                          const subBrand = subBrands.find((sb) => sb.id === id);
                          if (!subBrand) return null;
                          return (
                            <div
                              key={id}
                              className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs"
                            >
                              <span>{subBrand.name}</span>
                              <button
                                type="button"
                                onClick={() => setExcludedSubBrandIds((prev) => prev.filter((i) => i !== id))}
                                className="text-amber-600 hover:text-amber-800"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {subBrandSearch && (
                      <div className="border rounded-lg max-h-32 overflow-y-auto">
                        {subBrands
                          .filter((sb) => sb.name.toLowerCase().includes(subBrandSearch.toLowerCase()) && !excludedSubBrandIds.includes(sb.id))
                          .slice(0, 10)
                          .map((subBrand) => (
                            <button
                              key={subBrand.id}
                              type="button"
                              onClick={() => {
                                setExcludedSubBrandIds((prev) => [...prev, subBrand.id]);
                                setSubBrandSearch("");
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0 text-sm"
                            >
                              {subBrand.name}
                            </button>
                          ))}
                        {subBrands.filter((sb) => sb.name.toLowerCase().includes(subBrandSearch.toLowerCase()) && !excludedSubBrandIds.includes(sb.id)).length === 0 && (
                          <p className="p-2 text-gray-500 text-xs">No sub-brands found</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Excluded Items */}
              <div className="border rounded-lg p-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Items</p>
                {isLoadingItems ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search items..."
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        className="pl-10 h-9 text-sm"
                      />
                    </div>
                    {excludedItemIds.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {excludedItemIds.map((id) => {
                          const item = items.find((i) => i.id === id);
                          if (!item) return null;
                          return (
                            <div
                              key={id}
                              className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs"
                            >
                              <span>{item.name}</span>
                              <button
                                type="button"
                                onClick={() => setExcludedItemIds((prev) => prev.filter((i) => i !== id))}
                                className="text-amber-600 hover:text-amber-800"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {itemSearch && (
                      <div className="border rounded-lg max-h-32 overflow-y-auto">
                        {items
                          .filter((item) => (item.name.toLowerCase().includes(itemSearch.toLowerCase()) || item.itemCode.toLowerCase().includes(itemSearch.toLowerCase())) && !excludedItemIds.includes(item.id))
                          .slice(0, 10)
                          .map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setExcludedItemIds((prev) => [...prev, item.id]);
                                setItemSearch("");
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0"
                            >
                              <p className="font-medium text-sm">{item.name}</p>
                              <p className="text-xs text-gray-500">{item.itemCode}</p>
                            </button>
                          ))}
                        {items.filter((item) => (item.name.toLowerCase().includes(itemSearch.toLowerCase()) || item.itemCode.toLowerCase().includes(itemSearch.toLowerCase())) && !excludedItemIds.includes(item.id)).length === 0 && (
                          <p className="p-2 text-gray-500 text-xs">No items found</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Validity Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
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


            {/* Item Rate and Discount in a row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Rate (%) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="200"
                    value={itemRatePercent}
                    onChange={(e) => setItemRatePercent(e.target.value)}
                    className="pl-10"
                    placeholder="100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount (%)
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
                    className="pl-10"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Currency and Round Off */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((curr) => (
                      <SelectItem key={curr.value} value={curr.value}>
                        {curr.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Round Off
                </label>
                <Select value={roundOff} onValueChange={setRoundOff}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select rounding" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUND_OFF_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 border rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Active</p>
                <p className="text-sm text-gray-500">
                  {isActive
                    ? "Discount will be applied to orders"
                    : "Discount will NOT be applied to orders"}
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
    </div>
  );
}
