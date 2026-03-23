"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OrderItemRow } from "@/components/sales-orders/OrderItemRow";
import { ItemSelectionModal } from "@/components/sales-orders/ItemSelectionModal";
import { ConfigureDiscountsModal, InclusionDiscounts as ModalInclusionDiscounts } from "@/components/sales-orders/ConfigureDiscountsModal";
import { CustomerSelectionModal } from "@/components/sales-orders/CustomerSelectionModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Save,
  Search,
  X,
  Calculator,
  Settings2,
  Lock,
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
  creditDays: number;
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
  purchasePrice: number;
  mrp: number;
  sellingPrice: number;
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
  isGstInclusive: boolean;
}

const generateId = () => `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const toPositiveNumber = (value: unknown, fallback = 1) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const roundTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
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

const emptyOrderItem = (): OrderItemData => ({
  id: generateId(),
  itemId: "",
  quantity: 1,
  rate: 0,
  discountPercent: 0,
  taxRate: 0,
  taxAmount: 0,
  amount: 0,
  isGstInclusive: false,
});

function NewSalesInvoiceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const salesOrderId = searchParams.get("salesOrderId");

  // Form state
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [roundOff, setRoundOff] = useState(0);
  const [invoiceNumber, setInvoiceNumber] = useState("Loading...");

  // Customer state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);

  // Items state
  const [items, setItems] = useState<Item[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<OrderItemData[]>([emptyOrderItem()]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);

  // Local discount overrides
  const [localDiscounts, setLocalDiscounts] = useState<ModalInclusionDiscounts | null>(null);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [subBrands, setSubBrands] = useState<SubBrand[]>([]);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditBlocked, setIsEditBlocked] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      setIsLoadingCustomers(true);
      const res = await fetch("/api/customers?limit=500&activeOnly=true");
      if (res.ok) {
        const data = await res.json();
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
      const url = editId ? "/api/items?limit=9999" : "/api/items?limit=9999&activeOnly=true&isActive=true";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
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
  }, [editId]);

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

  const fetchNextInvoiceNumber = useCallback(async () => {
    try {
      const res = await fetch("/api/sales-invoices/next-number");
      if (res.ok) {
        const data = await res.json();
        setInvoiceNumber(data.invoiceNumber);
      }
    } catch (err) {
      console.error("Error fetching invoice number:", err);
    }
  }, []);

  const loadInvoiceForEdit = useCallback(async (invoiceId: string) => {
    try {
      setIsLoadingInvoice(true);
      const res = await fetch(`/api/sales-invoices/${invoiceId}`);
      if (res.ok) {
        const invoice = await res.json();
        if (invoice.paymentStatus === "PAID" || invoice.paymentStatus === "CANCELLED") {
          setIsEditBlocked(true);
          setInvoiceNumber(invoice.invoiceNumber || "");
          return;
        }
        setInvoiceNumber(invoice.invoiceNumber || "");
        setInvoiceDate(invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
        setDueDate(invoice.dueDate ? new Date(invoice.dueDate).toISOString().split("T")[0] : "");
        setNotes(invoice.notes || "");
        setRef(invoice.ref || "");

        if (invoice.customer) {
          // Fetch full customer with rate sheet
          try {
            const customerRes = await fetch(`/api/customers/${invoice.customer.id}`);
            if (customerRes.ok) {
              const raw = await customerRes.json();
              const entries: Array<{ rateSheet: Customer["rateSheet"] & { createdAt?: string } }> = raw.rateSheets || [];
              const sorted = [...entries].sort((a, b) => {
                const aDate = new Date(a.rateSheet?.createdAt || 0).getTime();
                const bDate = new Date(b.rateSheet?.createdAt || 0).getTime();
                return bDate - aDate;
              });
              setSelectedCustomer({ ...raw, rateSheet: sorted.length > 0 ? sorted[0].rateSheet : null });
            } else {
              setSelectedCustomer(invoice.customer);
            }
          } catch {
            setSelectedCustomer(invoice.customer);
          }
        }

        if (invoice.items && invoice.items.length > 0) {
          setInvoiceItems(invoice.items.map((item: { id?: string; itemId?: string; itemName?: string | null; item?: { id: string; name?: string; unit?: string }; quantity: number; rate: number; taxRate: number; taxAmount: number; amount: number; discountPercent?: number }) => ({
            id: item.id || generateId(),
            itemId: item.itemId || item.item?.id || "",
            itemName: item.itemName || item.item?.name || null,
            quantity: Number(item.quantity),
            unit: item.item?.unit,
            uomFactor: 1,
            rate: Number(item.rate),
            discountPercent: Number(item.discountPercent || 0),
            taxRate: Number(item.taxRate),
            taxAmount: Number(item.taxAmount),
            amount: Number(item.amount),
            isGstInclusive: Number(item.discountPercent || 0) > 0,
          })));
        }
      } else {
        setError("Failed to load invoice");
      }
    } catch (err) {
      console.error("Error loading invoice:", err);
      setError("Failed to load invoice");
    } finally {
      setIsLoadingInvoice(false);
    }
  }, []);

  const loadSalesOrderContext = useCallback(async (orderId: string) => {
    try {
      const res = await fetch(`/api/sales-orders/${orderId}`);
      if (!res.ok) return;
      const order = await res.json();

      if (order.customer) {
        // Fetch full customer with rate sheet
        try {
          const customerRes = await fetch(`/api/customers/${order.customer.id}`);
          if (customerRes.ok) {
            const raw = await customerRes.json();
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
      if (order.notes) setNotes(order.notes);
      if (order.customer?.creditDays) {
        const due = new Date(invoiceDate);
        due.setDate(due.getDate() + Number(order.customer.creditDays));
        setDueDate(due.toISOString().split("T")[0]);
      }

      if (Array.isArray(order.items) && order.items.length > 0) {
        setInvoiceItems(
          order.items.map((orderItem: { itemId: string; quantity: number; rate: number; taxRate: number; taxAmount: number; amount: number; discountPercent?: number; item?: { unit?: string } }) => ({
            id: generateId(),
            itemId: orderItem.itemId,
            quantity: Number(orderItem.quantity),
            unit: orderItem.item?.unit,
            uomFactor: 1,
            rate: Number(orderItem.rate),
            discountPercent: Number(orderItem.discountPercent || 0),
            taxRate: Number(orderItem.taxRate),
            taxAmount: Number(orderItem.taxAmount),
            amount: Number(orderItem.amount),
            isGstInclusive: Number(orderItem.discountPercent || 0) > 0,
          }))
        );
      }
    } catch (err) {
      console.error("Error loading sales order context:", err);
    }
  }, [invoiceDate]);

  useEffect(() => {
    fetchCustomers();
    fetchItems();
    fetchBrandsAndSubBrands();
    if (editId) {
      loadInvoiceForEdit(editId);
    } else {
      fetchNextInvoiceNumber();
      if (salesOrderId) {
        loadSalesOrderContext(salesOrderId);
      }
    }
  }, [fetchCustomers, fetchItems, fetchBrandsAndSubBrands, editId, loadInvoiceForEdit, fetchNextInvoiceNumber, salesOrderId, loadSalesOrderContext]);

  // Auto-set due date when customer selected
  useEffect(() => {
    if (selectedCustomer && !dueDate) {
      const due = new Date();
      due.setDate(due.getDate() + (selectedCustomer.creditDays || 30));
      setDueDate(due.toISOString().split("T")[0]);
    }
  }, [selectedCustomer, dueDate]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return [];
    const q = customerSearch.toLowerCase();
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || c.customerNumber.toLowerCase().includes(q) || (c.gstin && c.gstin.toLowerCase().includes(q)))
      .slice(0, 10);
  }, [customers, customerSearch]);

  const selectedItemIds = useMemo(
    () => invoiceItems.map((item) => item.itemId).filter(Boolean),
    [invoiceItems]
  );

  // Resolve discount from inclusion model using cascade logic
  const resolveInclusionDiscount = useCallback(
    (itemId: string, brandId: string | null | undefined, subBrandId: string | null | undefined, inclusionDiscounts: InclusionDiscounts | undefined): number => {
      if (!inclusionDiscounts) return 0;
      if (inclusionDiscounts.items && Array.isArray(inclusionDiscounts.items)) {
        const itemDiscount = inclusionDiscounts.items.find(i => i.id === itemId);
        if (itemDiscount) return Number(itemDiscount.discountPercent);
      }
      if (subBrandId && inclusionDiscounts.subBrands && Array.isArray(inclusionDiscounts.subBrands)) {
        const subBrandDiscount = inclusionDiscounts.subBrands.find(sb => sb.id === subBrandId);
        if (subBrandDiscount) return Number(subBrandDiscount.discountPercent);
      }
      if (brandId && inclusionDiscounts.brands && Array.isArray(inclusionDiscounts.brands)) {
        const brandDiscount = inclusionDiscounts.brands.find(b => b.id === brandId);
        if (brandDiscount) return Number(brandDiscount.discountPercent);
      }
      return 0;
    },
    []
  );

  // Get effective pricing for an item considering customer rate sheet
  const getEffectivePricing = useCallback(
    (item: Item, customer?: Customer | null): { rate: number; isGstInclusive: boolean; discountApplied: number } => {
      const mrp = Number(item.mrp) || Number(item.sellingPrice);
      const sellingPrice = Number(item.sellingPrice);
      const rateSheet = (customer || selectedCustomer)?.rateSheet;

      if (!rateSheet || !rateSheet.isActive) {
        return { rate: sellingPrice, isGstInclusive: false, discountApplied: 0 };
      }

      const useInclusionModel = rateSheet.useInclusionModel !== false;
      let discountPercent = 0;
      const effectiveDiscounts = localDiscounts || rateSheet.inclusionDiscounts;

      if (useInclusionModel) {
        const overrideDiscount = effectiveDiscounts
          ? resolveInclusionDiscount(item.id, item.brandId, item.subBrandId, effectiveDiscounts)
          : 0;
        // Fall back to rate sheet's default discount if no specific override found
        discountPercent = overrideDiscount > 0 ? overrideDiscount : (Number(rateSheet.discountPercent) || 0);
      } else {
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

      if (discountPercent === 0) {
        return { rate: sellingPrice, isGstInclusive: false, discountApplied: 0 };
      }

      const discountedRate = mrp * (1 - discountPercent / 100);
      return {
        rate: Math.round(discountedRate * 100) / 100,
        isGstInclusive: true,
        discountApplied: discountPercent,
      };
    },
    [selectedCustomer, localDiscounts, resolveInclusionDiscount]
  );

  // Handle customer selection — fetch full customer with rate sheet
  const handleCustomerSelect = async (customer: Customer) => {
    let fullCustomer = customer;
    try {
      const response = await fetch(`/api/customers/${customer.id}`);
      if (response.ok) {
        const raw = await response.json();
        const entries: Array<{ rateSheet: Customer["rateSheet"] & { createdAt?: string } }> = raw.rateSheets || [];
        const sorted = [...entries].sort((a, b) => {
          const aDate = new Date(a.rateSheet?.createdAt || 0).getTime();
          const bDate = new Date(b.rateSheet?.createdAt || 0).getTime();
          return bDate - aDate;
        });
        fullCustomer = { ...raw, rateSheet: sorted.length > 0 ? sorted[0].rateSheet : null };
      }
    } catch {
      // Use customer as-is
    }

    setSelectedCustomer(fullCustomer);
    setLocalDiscounts(null);
    setCustomerSearch("");

    // Recalculate item rates if rate sheet changes
    if (invoiceItems.some((item) => item.itemId)) {
      setInvoiceItems((prev) =>
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
            const totalInclusive = quantity * adjustedRate;
            baseAmount = totalInclusive / (1 + taxRate / 100);
            taxAmount = totalInclusive - baseAmount;
          } else {
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

  const buildOrderItemFromSelection = useCallback(
    (selectedItemData: Item, id: string, quantity = 1): OrderItemData => {
      const pricing = getEffectivePricing(selectedItemData);
      const taxRate = Number(selectedItemData.gstRate);

      let baseAmount: number;
      let taxAmount: number;

      if (pricing.isGstInclusive) {
        const totalInclusive = quantity * pricing.rate;
        baseAmount = totalInclusive / (1 + taxRate / 100);
        taxAmount = totalInclusive - baseAmount;
      } else {
        baseAmount = quantity * pricing.rate;
        taxAmount = baseAmount * (taxRate / 100);
      }

      return {
        id,
        itemId: selectedItemData.id,
        quantity,
        unit: selectedItemData.unit,
        uomFactor: 1,
        rate: pricing.rate,
        discountPercent: pricing.discountApplied,
        taxRate,
        taxAmount: Math.round(taxAmount * 100) / 100,
        amount: Math.round(baseAmount * 100) / 100,
        isGstInclusive: pricing.isGstInclusive,
      };
    },
    [getEffectivePricing]
  );

  const handleAddItem = () => {
    setIsAddItemModalOpen(true);
  };

  const handleAddItemSelect = (selectedItemData: Item) => {
    setInvoiceItems((prev) => {
      const firstEmptyIndex = prev.findIndex((row) => !row.itemId);
      if (firstEmptyIndex >= 0) {
        const next = [...prev];
        next[firstEmptyIndex] = buildOrderItemFromSelection(
          selectedItemData,
          next[firstEmptyIndex].id,
          next[firstEmptyIndex].quantity || 1
        );
        return next;
      }
      return [...prev, buildOrderItemFromSelection(selectedItemData, generateId())];
    });
  };

  const handleUpdateItem = (index: number, updatedItem: OrderItemData) => {
    const itemChanged = updatedItem.itemId && invoiceItems[index].itemId !== updatedItem.itemId;

    if (itemChanged) {
      const item = items.find((i) => i.id === updatedItem.itemId);
      if (item) {
        const pricing = getEffectivePricing(item);
        const quantity = updatedItem.quantity || 1;
        const taxRate = Number(item.gstRate);

        let baseAmount: number;
        let taxAmount: number;

        if (pricing.isGstInclusive) {
          const totalInclusive = quantity * pricing.rate;
          baseAmount = totalInclusive / (1 + taxRate / 100);
          taxAmount = totalInclusive - baseAmount;
        } else {
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

    setInvoiceItems((prev) => {
      const newItems = [...prev];
      newItems[index] = updatedItem;
      return newItems;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (invoiceItems.length === 1) {
      setInvoiceItems([emptyOrderItem()]);
    } else {
      setInvoiceItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const totals = useMemo(() => {
    const validItems = invoiceItems.filter((item) => item.itemId && item.amount > 0);
    const subtotal = validItems.reduce((s, i) => s + i.amount, 0);
    const totalTax = validItems.reduce((s, i) => s + i.taxAmount, 0);
    const total = subtotal + totalTax + roundOff;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      cgst: Math.round((totalTax / 2) * 100) / 100,
      sgst: Math.round((totalTax / 2) * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }, [invoiceItems, roundOff]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleSubmit = async () => {
    setError(null);

    if (!editId && !salesOrderId && !selectedCustomer) {
      setError("Please select a customer");
      return;
    }
    if (!invoiceDate) {
      setError("Please select an invoice date");
      return;
    }

    const validItems = invoiceItems.filter((i) => i.itemId && i.quantity > 0);
    if (validItems.length === 0) {
      setError("Please add at least one item");
      return;
    }

    setIsSubmitting(true);
    try {
      let response: Response;

      if (editId) {
        response = await fetch(`/api/sales-invoices/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dueDate,
            notes: notes || null,
            items: validItems.map((i) => ({
              itemId: i.itemId,
              quantity: roundTo(i.quantity * (i.uomFactor || 1), 3),
              rate: roundTo(i.rate / (i.uomFactor || 1), 2),
              taxRate: i.taxRate,
              discountPercent: i.discountPercent,
              isGstInclusive: i.isGstInclusive,
            })),
          }),
        });
      } else if (salesOrderId) {
        response = await fetch("/api/sales-invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            salesOrderId,
            invoiceDate,
            notes: notes || null,
            roundOff,
          }),
        });
      } else {
        response = await fetch("/api/sales-invoices/direct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: selectedCustomer!.id,
            invoiceDate,
            dueDate,
            ref: ref || null,
            notes: notes || null,
            roundOff,
            items: validItems.map((i) => ({
              itemId: i.itemId,
              quantity: roundTo(i.quantity * (i.uomFactor || 1), 3),
              rate: roundTo(i.rate / (i.uomFactor || 1), 2),
              taxRate: i.taxRate,
              discountPercent: i.discountPercent,
              isGstInclusive: i.isGstInclusive,
            })),
          }),
        });
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save invoice");

      mutate((key: unknown) => typeof key === "string" && key.startsWith("/api/sales-invoices"));
      router.push("/sales/invoices");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingInvoice || isLoadingItems) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Blocked edit popup */}
      <AlertDialog open={isEditBlocked} onOpenChange={() => {}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-red-500" />
              Cannot Edit Invoice
            </AlertDialogTitle>
            <AlertDialogDescription>
              Invoice <strong>#{invoiceNumber}</strong> has been fully paid and cannot be edited.
              Paid invoices are locked to preserve accurate financial records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => router.push("/sales/invoices")} className="bg-teal-500 hover:bg-teal-600">
              Go Back to Invoices
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="min-h-screen bg-gray-50">
        {/* Sticky action bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => router.push("/sales/invoices")} className="text-gray-500 -ml-2">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div className="h-4 w-px bg-gray-200" />
              <div>
                <span className="text-base font-bold text-gray-900">
                  {editId ? "Edit Sales Invoice" : "New Sales Invoice"}
                </span>
                <span className="ml-2 text-sm text-gray-400">#{invoiceNumber}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => router.push("/sales/invoices")}>Cancel</Button>
              <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || isEditBlocked} className="bg-teal-500 hover:bg-teal-600 text-white">
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving...</>
                ) : (
                  <><Save className="h-4 w-4 mr-1.5" />{editId ? "Update Invoice" : "Create Invoice"}</>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {/* Row 1: Invoice details + Customer */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Invoice Details</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Invoice Date <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date</label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Reference #</label>
                  <Input
                    type="text"
                    placeholder="Quotes, Sales order, Delivery Challan..."
                    value={ref}
                    onChange={(e) => setRef(e.target.value)}
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
                        <p className="p-3 text-gray-500 text-sm">No customers found</p>
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
                          <p className="font-medium text-teal-900">{selectedCustomer.name}</p>
                          <p className="text-sm text-teal-700">
                            {selectedCustomer.customerNumber}
                            {selectedCustomer.gstin && ` | GSTIN: ${selectedCustomer.gstin}`}
                          </p>
                          {selectedCustomer.rateSheet?.isActive && (
                            <p className="text-xs text-teal-600 mt-1">
                              {selectedCustomer.rateSheet.useInclusionModel ? (
                                <>Rate Sheet Applied: Custom discounts configured</>
                              ) : (
                                <>Rate Sheet Applied: {selectedCustomer.rateSheet.discountPercent}% discount</>
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
                          {!editId && !salesOrderId && (
                            <button
                              type="button"
                              onClick={() => { setSelectedCustomer(null); setLocalDiscounts(null); }}
                              className="text-teal-600 hover:text-teal-800"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Billing Address */}
                      {(selectedCustomer.address || selectedCustomer.city || selectedCustomer.state || selectedCustomer.pincode) && (
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                          <p className="text-sm font-medium text-gray-700 mb-2">Billing Address</p>
                          <div className="text-sm text-gray-600">
                            {selectedCustomer.address && <p>{selectedCustomer.address}</p>}
                            <p>
                              {[selectedCustomer.city, selectedCustomer.state, selectedCustomer.pincode]
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

          {/* Row 2: Items table */}
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
                      {invoiceItems.map((item, index) => (
                        <OrderItemRow
                          key={item.id}
                          item={item}
                          items={items}
                          selectedItemIds={selectedItemIds}
                          sno={index + 1}
                          onUpdate={(updatedItem) => handleUpdateItem(index, updatedItem)}
                          onRemove={() => handleRemoveItem(index)}
                          onItemCreated={fetchItems}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-gray-100">
                  <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Item
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Row 3: Notes + Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Notes</p>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes..."
                rows={4}
                className="resize-none"
              />
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
                  <span className="text-teal-600">{formatCurrency(totals.total)}</span>
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
            setInvoiceItems((prev) =>
              prev.map((orderItem) => {
                if (!orderItem.itemId) return orderItem;
                const item = items.find((i) => i.id === orderItem.itemId);
                if (!item) return orderItem;

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

      <ItemSelectionModal
        isOpen={isAddItemModalOpen}
        onClose={() => setIsAddItemModalOpen(false)}
        items={items}
        selectedItemIds={selectedItemIds}
        onSelect={handleAddItemSelect}
        onItemCreated={fetchItems}
      />
    </DashboardLayout>
  );
}

export default function NewSalesInvoicePage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="p-6 flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
          </div>
        </DashboardLayout>
      }
    >
      <NewSalesInvoiceContent />
    </Suspense>
  );
}
