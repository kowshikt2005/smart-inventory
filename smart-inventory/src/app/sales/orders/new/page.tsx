"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OrderItemRow } from "@/components/sales-orders/OrderItemRow";
import { ConfigureDiscountsModal, InclusionDiscounts as ModalInclusionDiscounts } from "@/components/sales-orders/ConfigureDiscountsModal";
import { CustomerSelectionModal } from "@/components/sales-orders/CustomerSelectionModal";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Save,
  Search,
  X,
  Calculator,
  Settings2,
  Copy,
} from "lucide-react";
import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { mutate } from "swr";

interface InclusionDiscount {
  id: string;
  discountPercent: number;
}

interface InclusionDiscounts {
  brands?: InclusionDiscount[];
  subBrands?: InclusionDiscount[];
  items?: InclusionDiscount[];
}

interface Customer {
  id: string;
  customerNumber: string;
  name: string;
  gstin: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  rateSheet?: {
    id: string;
    isActive: boolean;
    discountPercent: number;
    useInclusionModel?: boolean;
    inclusionDiscounts?: InclusionDiscounts;
    excludedItemIds?: string[];
    excludedBrandIds?: string[];
    excludedSubBrandIds?: string[];
  } | null;
}

interface Item {
  id: string;
  itemCode: string;
  name: string;
  unit: string;
  hsnCode: string | null;
  gstRate: number;
  purchasePrice: number; // Cost price
  mrp: number; // Maximum Retail Price
  sellingPrice: number; // Actual selling price (used as base rate for orders)
  discountPercent?: number | null;
  brandId?: string | null;
  subBrandId?: string | null;
  brand?: { id: string; name: string } | null;
  subBrand?: { id: string; name: string } | null;
  uomConversions?: Array<{ name: string; factor: number }> | null;
  inventory?: {
    physicalStock: number;
    reservedQuantity: number;
  } | null;
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

interface InsufficientStockItem {
  itemName: string;
  itemCode: string;
  required: number;
  available: number;
  shortfall: number;
}

interface OrderItemData {
  id: string;
  itemId: string;
  quantity: number;
  unit?: string;
  uomFactor?: number;
  rate: number;
  discountPercent: number;
  taxRate: number;
  taxAmount: number;
  amount: number;
  isGstInclusive: boolean; // true = MRP with discount (inclusive), false = selling price (exclusive)
}

// Generate unique ID for new items
const generateId = () => `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const roundTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const toPositiveNumber = (value: unknown, fallback = 1) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeUomConversions = (rawConversions: unknown) => {
  if (!Array.isArray(rawConversions)) return null;

  const normalized = rawConversions
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const rawName = (entry as { name?: unknown }).name;
      const rawFactor = (entry as { factor?: unknown }).factor;
      const name = typeof rawName === "string" ? rawName.trim().toUpperCase() : "";
      const factor = toPositiveNumber(rawFactor, 0);
      if (!name || factor <= 0) return null;
      return { name, factor };
    })
    .filter((entry): entry is { name: string; factor: number } => Boolean(entry));

  return normalized.length > 0 ? normalized : null;
};

function NewSalesOrderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const copyId = searchParams.get("copy");

  // Form state
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [roundOff, setRoundOff] = useState(0);

  // Customer state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);

  // Items state
  const [items, setItems] = useState<Item[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemData[]>([
    {
      id: generateId(),
      itemId: "",
      quantity: 1,
      rate: 0,
      discountPercent: 0,
      taxRate: 0,
      taxAmount: 0,
      amount: 0,
      isGstInclusive: false,
    },
  ]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Local discount overrides
  const [localDiscounts, setLocalDiscounts] = useState<ModalInclusionDiscounts | null>(null);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [subBrands, setSubBrands] = useState<SubBrand[]>([]);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState("Loading...");

  const fetchCustomers = useCallback(async () => {
    try {
      setIsLoadingCustomers(true);
      const response = await fetch("/api/customers?limit=500&status=ACTIVE");
      if (response.ok) {
        const data = await response.json();
        setCustomers(data.customers || []);
      }
    } catch (err) {
      console.error("Error fetching customers:", err);
    } finally {
      setIsLoadingCustomers(false);
    }
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      setIsLoadingItems(true);
      // Fetch only essential fields for better performance
      const response = await fetch("/api/items?limit=9999&activeOnly=true&isActive=true");
      if (response.ok) {
        const data = await response.json();
        const normalizedItems = (data.items || []).map((item: Item) => ({
          ...item,
          uomConversions: normalizeUomConversions(item.uomConversions),
        }));
        setItems(normalizedItems);
      }
    } catch (err) {
      console.error("Error fetching items:", err);
    } finally {
      setIsLoadingItems(false);
    }
  }, []);

  const fetchBrandsAndSubBrands = useCallback(async () => {
    try {
      const [brandsRes, subBrandsRes] = await Promise.all([
        fetch("/api/brands?limit=500"),
        fetch("/api/sub-brands?limit=500"),
      ]);
      if (brandsRes.ok) {
        const data = await brandsRes.json();
        setBrands(data.brands || []);
      }
      if (subBrandsRes.ok) {
        const data = await subBrandsRes.json();
        setSubBrands(data.subBrands || []);
      }
    } catch (err) {
      console.error("Error fetching brands/sub-brands:", err);
    }
  }, []);

  const loadOrderForEdit = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/sales-orders/${id}`);
      if (response.ok) {
        const order = await response.json();

        // Check if order is editable
        if (order.status !== "OPEN" && order.status !== "HOLD") {
          alert("Only orders with OPEN or HOLD status can be edited");
          router.push("/sales/orders");
          return;
        }

        setOrderNumber(order.orderNumber);
        setOrderDate(order.orderDate.split("T")[0]);
        setReferenceNumber(order.referenceNumber || "");
        setNotes(order.notes || "");
        setTerms(order.terms || "");
        setRoundOff(Number(order.discountAmount) || 0);

        // Set customer - fetch full customer with rate sheet for proper pricing
        if (order.customer) {
          try {
            const customerResponse = await fetch(`/api/customers/${order.customer.id}`);
            if (customerResponse.ok) {
              const raw = await customerResponse.json();
              const entries: Array<{ rateSheet: Customer["rateSheet"] & { createdAt?: string } }> = raw.rateSheets || [];
              const sorted = [...entries].sort((a, b) => {
                const aDate = new Date(a.rateSheet?.createdAt || 0).getTime();
                const bDate = new Date(b.rateSheet?.createdAt || 0).getTime();
                return bDate - aDate;
              });
              setSelectedCustomer({ ...raw, rateSheet: sorted.length > 0 ? sorted[0].rateSheet : null });
            } else {
              setSelectedCustomer(order.customer);
            }
          } catch {
            setSelectedCustomer(order.customer);
          }
        }

        // Set order items
        if (order.items && order.items.length > 0) {
          interface ApiOrderItem {
            id: string;
            itemId: string;
            quantity: number;
            rate: number;
            discountPercent?: number;
            taxRate: number;
            taxAmount: number;
            amount: number;
            item?: {
              unit?: string;
            };
          }
          setOrderItems(
            order.items.map((item: ApiOrderItem) => ({
              id: item.id,
              itemId: item.itemId,
              quantity: Number(item.quantity),
              unit: item.item?.unit,
              uomFactor: 1,
              rate: Number(item.rate),
              discountPercent: Number(item.discountPercent) || 0,
              taxRate: Number(item.taxRate),
              taxAmount: Number(item.taxAmount),
              amount: Number(item.amount),
              isGstInclusive: Number(item.discountPercent) > 0, // If discount applied, it was MRP-based (inclusive)
            }))
          );
        }
      }
    } catch (err) {
      console.error("Error loading order:", err);
      alert("Failed to load order for editing");
      router.push("/sales/orders");
    }
  }, [router]);

  // Load order data for copy (pre-fills form but creates a new order)
  const loadOrderForCopy = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/sales-orders/${id}`);
      if (response.ok) {
        const order = await response.json();

        setReferenceNumber(order.referenceNumber || "");
        setNotes(order.notes || "");
        setTerms(order.terms || "");
        setRoundOff(Number(order.discountAmount) || 0);

        // Set customer
        if (order.customer) {
          try {
            const customerResponse = await fetch(`/api/customers/${order.customer.id}`);
            if (customerResponse.ok) {
              const raw = await customerResponse.json();
              const entries: Array<{ rateSheet: Customer["rateSheet"] & { createdAt?: string } }> = raw.rateSheets || [];
              const sorted = [...entries].sort((a, b) => {
                const aDate = new Date(a.rateSheet?.createdAt || 0).getTime();
                const bDate = new Date(b.rateSheet?.createdAt || 0).getTime();
                return bDate - aDate;
              });
              setSelectedCustomer({ ...raw, rateSheet: sorted.length > 0 ? sorted[0].rateSheet : null });
            } else {
              setSelectedCustomer(order.customer);
            }
          } catch {
            setSelectedCustomer(order.customer);
          }
        }

        // Set order items
        if (order.items && order.items.length > 0) {
          interface ApiOrderItem {
            id: string;
            itemId: string;
            quantity: number;
            rate: number;
            discountPercent?: number;
            taxRate: number;
            taxAmount: number;
            amount: number;
            item?: {
              unit?: string;
            };
          }
          setOrderItems(
            order.items.map((item: ApiOrderItem) => ({
              id: generateId(),
              itemId: item.itemId,
              quantity: Number(item.quantity),
              unit: item.item?.unit,
              uomFactor: 1,
              rate: Number(item.rate),
              discountPercent: Number(item.discountPercent) || 0,
              taxRate: Number(item.taxRate),
              taxAmount: Number(item.taxAmount),
              amount: Number(item.amount),
              isGstInclusive: Number(item.discountPercent) > 0,
            }))
          );
        }
      }
    } catch (err) {
      console.error("Error loading order for copy:", err);
      alert("Failed to load order data");
      router.push("/sales/orders");
    }
  }, [router]);

  // Fetch next order number for new orders
  const fetchNextOrderNumber = useCallback(async () => {
    try {
      const response = await fetch("/api/sales-orders/next-number");
      if (response.ok) {
        const data = await response.json();
        setOrderNumber(data.orderNumber);
      }
    } catch (err) {
      console.error("Error fetching next order number:", err);
    }
  }, []);

  // Fetch customers
  useEffect(() => {
    fetchCustomers();
    fetchItems();
    fetchBrandsAndSubBrands();
  }, [fetchCustomers, fetchItems, fetchBrandsAndSubBrands]);

  // Load order for editing/copying OR fetch next order number for new order
  useEffect(() => {
    if (editId) {
      loadOrderForEdit(editId);
    } else {
      fetchNextOrderNumber();
      if (copyId) {
        loadOrderForCopy(copyId);
      }
    }
  }, [editId, copyId, loadOrderForEdit, loadOrderForCopy, fetchNextOrderNumber]);

  // Filter customers based on search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return [];
    const query = customerSearch.toLowerCase();
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.customerNumber.toLowerCase().includes(query)
      )
      .slice(0, 10);
  }, [customers, customerSearch]);

  // Get selected item IDs (for preventing duplicates)
  const selectedItemIds = useMemo(
    () => orderItems.map((item) => item.itemId).filter(Boolean),
    [orderItems]
  );

  // Resolve discount from inclusion model using cascade logic
  // Priority: Item discount > Sub-brand discount > Brand discount > 0%
  const resolveInclusionDiscount = useCallback(
    (itemId: string, brandId: string | null | undefined, subBrandId: string | null | undefined, inclusionDiscounts: InclusionDiscounts | undefined): number => {
      if (!inclusionDiscounts) return 0;

      // Check item first (highest priority)
      if (inclusionDiscounts.items && Array.isArray(inclusionDiscounts.items)) {
        const itemDiscount = inclusionDiscounts.items.find(i => i.id === itemId);
        if (itemDiscount) return Number(itemDiscount.discountPercent);
      }

      // Check sub-brand second
      if (subBrandId && inclusionDiscounts.subBrands && Array.isArray(inclusionDiscounts.subBrands)) {
        const subBrandDiscount = inclusionDiscounts.subBrands.find(sb => sb.id === subBrandId);
        if (subBrandDiscount) return Number(subBrandDiscount.discountPercent);
      }

      // Check brand last
      if (brandId && inclusionDiscounts.brands && Array.isArray(inclusionDiscounts.brands)) {
        const brandDiscount = inclusionDiscounts.brands.find(b => b.id === brandId);
        if (brandDiscount) return Number(brandDiscount.discountPercent);
      }

      return 0; // Item not included
    },
    []
  );

  // Get effective pricing for an item considering customer rate sheet
  // Returns: { rate, isGstInclusive, discountApplied }
  //
  // NEW PRICING LOGIC:
  // - No rate sheet → selling price + EXCLUSIVE GST
  // - Rate sheet with 0% discount → selling price + EXCLUSIVE GST
  // - Rate sheet with discount > 0 → MRP + INCLUSIVE GST
  const getEffectivePricing = useCallback(
    (item: Item, customer?: Customer | null): { rate: number; isGstInclusive: boolean; discountApplied: number } => {
      const mrp = Number(item.mrp) || Number(item.sellingPrice);
      const sellingPrice = Number(item.sellingPrice);
      const _gstRate = Number(item.gstRate);
      const rateSheet = (customer || selectedCustomer)?.rateSheet;

      // No rate sheet - use sellingPrice + EXCLUSIVE GST
      if (!rateSheet || !rateSheet.isActive) {
        return {
          rate: sellingPrice,
          isGstInclusive: false,
          discountApplied: 0,
        };
      }

      // Customer has rate sheet - check for discount
      const useInclusionModel = rateSheet.useInclusionModel !== false;
      let discountPercent = 0;

      // Use local overrides if configured, otherwise fall back to rate sheet
      const effectiveDiscounts = localDiscounts || rateSheet.inclusionDiscounts;

      if (useInclusionModel && effectiveDiscounts) {
        // Inclusion model: Get cascade discount (item > sub-brand > brand)
        discountPercent = resolveInclusionDiscount(
          item.id,
          item.brandId,
          item.subBrandId,
          effectiveDiscounts
        );
      } else {
        // Legacy model
        const excludedItemIds = rateSheet.excludedItemIds || [];
        const excludedBrandIds = rateSheet.excludedBrandIds || [];
        const excludedSubBrandIds = rateSheet.excludedSubBrandIds || [];

        const isExcluded =
          (Array.isArray(excludedItemIds) && excludedItemIds.includes(item.id)) ||
          (item.brandId && Array.isArray(excludedBrandIds) && excludedBrandIds.includes(item.brandId)) ||
          (item.subBrandId && Array.isArray(excludedSubBrandIds) && excludedSubBrandIds.includes(item.subBrandId));

        if (!isExcluded) {
          discountPercent = Number(rateSheet.discountPercent) || 0;
        }
      }

      // If no discount configured, use selling price + EXCLUSIVE GST
      if (discountPercent === 0) {
        return {
          rate: sellingPrice,
          isGstInclusive: false,
          discountApplied: 0,
        };
      }

      // Discount is configured - use MRP + INCLUSIVE GST
      // Apply discount to MRP (MRP already includes GST)
      const discountedRate = mrp * (1 - discountPercent / 100);
      return {
        rate: Math.round(discountedRate * 100) / 100,
        isGstInclusive: true,
        discountApplied: discountPercent,
      };
    },
    [selectedCustomer, localDiscounts, resolveInclusionDiscount]
  );

  // Backward compatible getEffectiveRate function
  const _getEffectiveRate = useCallback(
    (item: Item, customer?: Customer | null) => {
      return getEffectivePricing(item, customer).rate;
    },
    [getEffectivePricing]
  );

  // Handle customer selection
  const handleCustomerSelect = async (customer: Customer) => {
    // Fetch customer with rate sheet and normalize the shape
    let fullCustomer = customer;
    try {
      const response = await fetch(`/api/customers/${customer.id}`);
      if (response.ok) {
        const raw = await response.json();
        // API returns rateSheets[] (join table), but pricing logic expects rateSheet (singular)
        const entries: Array<{ rateSheet: Customer["rateSheet"] & { createdAt?: string } }> = raw.rateSheets || [];
        const sorted = [...entries].sort((a, b) => {
          const aDate = new Date(a.rateSheet?.createdAt || 0).getTime();
          const bDate = new Date(b.rateSheet?.createdAt || 0).getTime();
          return bDate - aDate;
        });
        fullCustomer = {
          ...raw,
          rateSheet: sorted.length > 0 ? sorted[0].rateSheet : null,
        };
      }
    } catch {
      // Use the customer as-is if fetch fails
    }

    setSelectedCustomer(fullCustomer);
    setLocalDiscounts(null); // Reset local discount overrides for new customer
    setCustomerSearch("");

    // Recalculate item rates if rate sheet changes
    if (orderItems.some((item) => item.itemId)) {
      setOrderItems((prev) =>
        prev.map((orderItem) => {
          if (!orderItem.itemId) return orderItem;
          const item = items.find((i) => i.id === orderItem.itemId);
          if (!item) return orderItem;

          const pricing = getEffectivePricing(item, fullCustomer);
          const quantity = orderItem.quantity;
          const taxRate = orderItem.taxRate;
          const factor = orderItem.uomFactor || 1;
          const adjustedRate = pricing.rate * factor;

          let baseAmount: number;
          let taxAmount: number;

          if (pricing.isGstInclusive) {
            // MRP-based: Rate includes GST, extract tax
            const totalInclusive = quantity * adjustedRate;
            baseAmount = totalInclusive / (1 + taxRate / 100);
            taxAmount = totalInclusive - baseAmount;
          } else {
            // Selling price: Rate is exclusive, add tax on top
            baseAmount = quantity * adjustedRate;
            taxAmount = baseAmount * (taxRate / 100);
          }

          return {
            ...orderItem,
            rate: Math.round(adjustedRate * 100) / 100,
            discountPercent: pricing.discountApplied,
            amount: Math.round(baseAmount * 100) / 100,
            taxAmount: Math.round(taxAmount * 100) / 100,
            isGstInclusive: pricing.isGstInclusive,
          };
        })
      );
    }
  };

  // Handle adding new item row
  const handleAddItem = () => {
    setOrderItems((prev) => [
      ...prev,
      {
        id: generateId(),
        itemId: "",
        quantity: 1,
        rate: 0,
        discountPercent: 0,
        taxRate: 0,
        taxAmount: 0,
        amount: 0,
        isGstInclusive: false,
      },
    ]);
  };

  // Handle updating item row
  const handleUpdateItem = (index: number, updatedItem: OrderItemData) => {
    // Apply customer rate sheet if selecting new item or item changed
    const itemChanged = updatedItem.itemId && orderItems[index].itemId !== updatedItem.itemId;

    if (itemChanged) {
      const item = items.find((i) => i.id === updatedItem.itemId);
      if (item) {
        const pricing = getEffectivePricing(item);
        const quantity = updatedItem.quantity || 1;
        const taxRate = Number(item.gstRate);

        let baseAmount: number;
        let taxAmount: number;

        if (pricing.isGstInclusive) {
          // MRP-based: Rate includes GST, extract tax
          const totalInclusive = quantity * pricing.rate;
          baseAmount = totalInclusive / (1 + taxRate / 100);
          taxAmount = totalInclusive - baseAmount;
        } else {
          // Selling price: Rate is exclusive, add tax on top
          baseAmount = quantity * pricing.rate;
          taxAmount = baseAmount * (taxRate / 100);
        }

        updatedItem = {
          ...updatedItem,
          quantity,
          unit: item.unit,
          uomFactor: 1,
          rate: pricing.rate,
          discountPercent: pricing.discountApplied,
          taxRate,
          amount: Math.round(baseAmount * 100) / 100,
          taxAmount: Math.round(taxAmount * 100) / 100,
          isGstInclusive: pricing.isGstInclusive,
        };
      }
    }

    setOrderItems((prev) => {
      const newItems = [...prev];
      newItems[index] = updatedItem;
      return newItems;
    });
  };

  // Handle removing item row
  const handleRemoveItem = (index: number) => {
    if (orderItems.length === 1) {
      // Reset instead of remove if it's the last one
      setOrderItems([
        {
          id: generateId(),
          itemId: "",
          quantity: 1,
          rate: 0,
          discountPercent: 0,
          taxRate: 0,
          taxAmount: 0,
          amount: 0,
          isGstInclusive: false,
        },
      ]);
    } else {
      setOrderItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // Calculate totals
  const totals = useMemo(() => {
    const validItems = orderItems.filter((item) => item.itemId && item.amount > 0);
    const subtotal = validItems.reduce((sum, item) => sum + item.amount, 0);
    const totalTax = validItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const cgst = totalTax / 2;
    const sgst = totalTax / 2;
    const totalAmount = subtotal + totalTax + roundOff;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      cgst: Math.round(cgst * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
    };
  }, [orderItems, roundOff]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Handle form submission
  const handleSubmit = async () => {
    setError(null);

    // Validation
    if (!selectedCustomer) {
      setError("Please select a customer");
      return;
    }

    if (!orderDate) {
      setError("Please select an order date");
      return;
    }

    const validItems = orderItems.filter(
      (item) => item.itemId && item.quantity > 0 && item.rate > 0
    );

    if (validItems.length === 0) {
      setError("Please add at least one item with valid quantity and rate");
      return;
    }

    setIsSubmitting(true);

    try {
      const payloadItems = validItems.map((item) => {
        const factor = toPositiveNumber(item.uomFactor, 1);
        return {
          itemId: item.itemId,
          quantity: roundTo(item.quantity * factor, 3),
          rate: roundTo(item.rate / factor, 2),
          discountPercent: item.discountPercent,
          unit: item.unit,
          uomFactor: factor,
        };
      });

      const payload = {
        customerId: selectedCustomer.id,
        orderDate,
        referenceNumber: referenceNumber || null,
        notes: notes || null,
        terms: terms || null,
        roundOff,
        items: payloadItems,
      };

      const url = editId
        ? `/api/sales-orders/${editId}`
        : "/api/sales-orders";
      const method = editId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      // Handle stock warning (409 status)
      if (response.status === 409 && data.warning) {
        const proceed = confirm(
          `Warning: Some items have insufficient stock:\n\n${data.insufficientStock
            .map(
              (item: InsufficientStockItem) =>
                `${item.itemName} (${item.itemCode}):\n  Required: ${item.required}\n  Available: ${item.available}\n  Missing: ${item.shortfall}`
            )
            .join("\n\n")}\n\nDo you want to create the order anyway?`
        );

        if (proceed) {
          // Retry with forceCreate flag
          const forceResponse = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, forceCreate: true }),
          });

          if (!forceResponse.ok) {
            const errorData = await forceResponse.json();
            throw new Error(errorData.error || "Failed to save order");
          }

          // Invalidate sales orders cache to show the new order
          mutate(key => typeof key === 'string' && key.includes('/api/sales-orders'), undefined, { revalidate: true });
          
          router.push("/sales/orders");
          return;
        } else {
          // User cancelled
          setIsSubmitting(false);
          return;
        }
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to save order");
      }

      // Invalidate sales orders cache to show the new order
      mutate(key => typeof key === 'string' && key.includes('/api/sales-orders'), undefined, { revalidate: true });

      router.push("/sales/orders");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Sticky action bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => router.push("/sales/orders")} className="text-gray-500 -ml-2">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div className="h-4 w-px bg-gray-200" />
              <div>
                <span className="text-base font-bold text-gray-900">
                  {editId ? "Edit Sales Order" : copyId ? "Duplicate Sales Order" : "New Sales Order"}
                </span>
                <span className="ml-2 text-sm text-gray-400">#{orderNumber}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => router.push("/sales/orders")}>Cancel</Button>
              <Button size="sm" onClick={handleSubmit} disabled={isSubmitting} className="bg-teal-500 hover:bg-teal-600 text-white">
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving...</>
                ) : (
                  <><Save className="h-4 w-4 mr-1.5" />{editId ? "Update Order" : "Create Order"}</>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Copy mode notice */}
          {copyId && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700 text-sm flex items-center gap-2">
              <Copy className="h-4 w-4 shrink-0" />
              Duplicating from an existing order — review and save to create a new order.
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {/* Row 1: Order details + Customer */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Order Details</p>
              <div className="space-y-3">
                {/* Order Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Order Date <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>

                {/* Reference Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Reference #
                  </label>
                  <Input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="PO No, Quotes, Delivery Challan..."
                  />
                </div>
              </div>
            </div>

            {/* Customer Card */}
            <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Customer <span className="text-red-400">*</span>
              </p>
              {isLoadingCustomers ? (
                <div className="flex items-center gap-2 text-gray-500 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading customers...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {!selectedCustomer && (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="Search customers by name or number..."
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCustomerModalOpen(true)}
                        className="shrink-0"
                      >
                        Browse
                      </Button>
                    </div>
                  )}
                    {customerSearch && !selectedCustomer && (
                      <div className="border rounded-lg max-h-48 overflow-y-auto">
                        {filteredCustomers.length === 0 ? (
                          <p className="p-3 text-gray-500 text-sm">
                            No customers found
                          </p>
                        ) : (
                          filteredCustomers.map((customer) => (
                            <button
                              key={customer.id}
                              type="button"
                              onClick={() => handleCustomerSelect(customer)}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
                            >
                              <p className="font-medium">{customer.name}</p>
                              <p className="text-xs text-gray-500">
                                {customer.customerNumber}
                                {customer.gstin && ` | GSTIN: ${customer.gstin}`}
                                {customer.city && ` | ${customer.city}`}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                    {selectedCustomer && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 bg-teal-50 border border-teal-200 rounded-lg">
                          <div>
                            <p className="font-medium text-teal-900">
                              {selectedCustomer.name}
                            </p>
                            <p className="text-sm text-teal-700">
                              {selectedCustomer.customerNumber}
                              {selectedCustomer.gstin &&
                                ` | GSTIN: ${selectedCustomer.gstin}`}
                            </p>
                            {selectedCustomer.rateSheet?.isActive && (
                              <p className="text-xs text-teal-600 mt-1">
                                {selectedCustomer.rateSheet.useInclusionModel ? (
                                  <>
                                    Rate Sheet Applied: Custom discounts configured
                                  </>
                                ) : (
                                  <>
                                    Rate Sheet Applied: {selectedCustomer.rateSheet.discountPercent}% discount
                                  </>
                                )}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedCustomer.rateSheet?.isActive && selectedCustomer.rateSheet?.useInclusionModel !== false && (
                              <button
                                type="button"
                                onClick={() => setShowDiscountModal(true)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                                  localDiscounts
                                    ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
                                    : "bg-white border-teal-300 text-teal-700 hover:bg-teal-50"
                                }`}
                              >
                                <Settings2 className="h-4 w-4" />
                                {localDiscounts ? "Custom Discounts" : "Configure Discounts"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => { setSelectedCustomer(null); setLocalDiscounts(null); }}
                              className="text-teal-600 hover:text-teal-800"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                        {/* Billing Address Section */}
                        {(selectedCustomer.address || selectedCustomer.city || selectedCustomer.state || selectedCustomer.pincode) && (
                          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                            <p className="text-sm font-medium text-gray-700 mb-2">Billing Address</p>
                            <div className="text-sm text-gray-600">
                              {selectedCustomer.address && (
                                <p>{selectedCustomer.address}</p>
                              )}
                              <p>
                                {[
                                  selectedCustomer.city,
                                  selectedCustomer.state,
                                  selectedCustomer.pincode,
                                ]
                                  .filter(Boolean)
                                  .join(", ")}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <CustomerSelectionModal
                      isOpen={isCustomerModalOpen}
                      onClose={() => setIsCustomerModalOpen(false)}
                      customers={customers}
                      onSelect={(customer) => {
                        setIsCustomerModalOpen(false);
                        handleCustomerSelect(customer);
                      }}
                    />
                  </div>
                )}
            </div>
          </div>

          {/* Items Section */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Line Items</p>
            </div>
            {isLoadingItems ? (
              <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading items...</span>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">S.No</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">HSN/SAC</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">Tax %</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Qty</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">Unit</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Rate ₹</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Rate ₹ (Incl. Tax)</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">MRP</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Disc %</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Amount</th>
                        <th className="px-3 py-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderItems.map((item, index) => (
                        <OrderItemRow
                          key={item.id}
                          item={item}
                          items={items}
                          selectedItemIds={selectedItemIds}
                          sno={index + 1}
                          onUpdate={(updatedItem) =>
                            handleUpdateItem(index, updatedItem)
                          }
                          onRemove={() => handleRemoveItem(index)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-gray-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddItem}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Item
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Notes + Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Notes</p>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes about this order..."
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Terms & Conditions</p>
                <Textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="Terms and conditions for this order..."
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="h-4 w-4 text-gray-400" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Summary</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Taxable Value</span>
                  <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">CGST</span>
                  <span>{formatCurrency(totals.cgst)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">SGST</span>
                  <span>{formatCurrency(totals.sgst)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Round Off</span>
                  <Input
                    type="number" step="0.01" min="-1" max="1"
                    value={roundOff}
                    onChange={(e) => setRoundOff(parseFloat(e.target.value) || 0)}
                    className="w-24 text-right h-8"
                  />
                </div>
                <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span className="text-teal-600">{formatCurrency(totals.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Configure Discounts Modal */}
      {selectedCustomer && (
        <ConfigureDiscountsModal
          open={showDiscountModal}
          onClose={() => setShowDiscountModal(false)}
          discounts={
            localDiscounts || {
              brands: selectedCustomer.rateSheet?.inclusionDiscounts?.brands || [],
              subBrands: selectedCustomer.rateSheet?.inclusionDiscounts?.subBrands || [],
              items: selectedCustomer.rateSheet?.inclusionDiscounts?.items || [],
            }
          }
          onSave={(newDiscounts) => {
            setLocalDiscounts(newDiscounts);
            // Recalculate all existing order items with new discounts
            setOrderItems((prev) =>
              prev.map((orderItem) => {
                if (!orderItem.itemId) return orderItem;
                const item = items.find((i) => i.id === orderItem.itemId);
                if (!item) return orderItem;

                // Resolve discount using the new local discounts
                let discountPercent = 0;
                if (newDiscounts.items?.length) {
                  const itemDiscount = newDiscounts.items.find(i => i.id === item.id);
                  if (itemDiscount) discountPercent = Number(itemDiscount.discountPercent);
                }
                if (discountPercent === 0 && item.subBrandId && newDiscounts.subBrands?.length) {
                  const sbDiscount = newDiscounts.subBrands.find(sb => sb.id === item.subBrandId);
                  if (sbDiscount) discountPercent = Number(sbDiscount.discountPercent);
                }
                if (discountPercent === 0 && item.brandId && newDiscounts.brands?.length) {
                  const bDiscount = newDiscounts.brands.find(b => b.id === item.brandId);
                  if (bDiscount) discountPercent = Number(bDiscount.discountPercent);
                }

                const mrp = Number(item.mrp) || Number(item.sellingPrice);
                const sellingPrice = Number(item.sellingPrice);
                const taxRate = orderItem.taxRate;
                const quantity = orderItem.quantity;
                const factor = orderItem.uomFactor || 1;

                let rate: number;
                let isGstInclusive: boolean;
                if (discountPercent > 0) {
                  rate = Math.round(mrp * (1 - discountPercent / 100) * factor * 100) / 100;
                  isGstInclusive = true;
                } else {
                  rate = Math.round(sellingPrice * factor * 100) / 100;
                  isGstInclusive = false;
                }

                let baseAmount: number;
                let taxAmount: number;
                if (isGstInclusive) {
                  const totalInclusive = quantity * rate;
                  baseAmount = totalInclusive / (1 + taxRate / 100);
                  taxAmount = totalInclusive - baseAmount;
                } else {
                  baseAmount = quantity * rate;
                  taxAmount = baseAmount * (taxRate / 100);
                }

                return {
                  ...orderItem,
                  rate,
                  discountPercent,
                  amount: Math.round(baseAmount * 100) / 100,
                  taxAmount: Math.round(taxAmount * 100) / 100,
                  isGstInclusive,
                };
              })
            );
          }}
          brands={brands}
          subBrands={subBrands}
          items={items}
        />
      )}
    </DashboardLayout>
  );
}

export default function NewSalesOrderPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        </div>
      </DashboardLayout>
    }>
      <NewSalesOrderPageContent />
    </Suspense>
  );
}
