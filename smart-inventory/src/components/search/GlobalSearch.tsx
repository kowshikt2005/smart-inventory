"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Search,
  Users,
  Package,
  ShoppingCart,
  FileText,
  Receipt,
  CreditCard,
  RotateCcw,
  Building2,
  UserCircle,
  DollarSign,
  Tag,
  Layers,
  BookOpen,
  ClipboardList,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import useSWR from "swr";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  type: string;
  category: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  metadata?: Record<string, string | number | boolean>;
}

interface GlobalSearchProps {
  placeholder?: string;
  className?: string;
}

const SEARCH_CATEGORIES = {
  navigation: "Navigation",
  customers: "Customers", 
  vendors: "Vendors",
  items: "Items",
  orders: "Sales Orders",
  invoices: "Invoices",
  payments: "Payments",
  returns: "Returns",
  ledger: "Ledger",
  journals: "Stock Journals",
};

const NAVIGATION_ITEMS: SearchResult[] = [
  {
    id: "nav-dashboard",
    title: "Dashboard",
    subtitle: "Overview and analytics",
    type: "navigation",
    category: "navigation",
    url: "/",
    icon: Search,
  },
  {
    id: "nav-sales-orders",
    title: "Sales Orders",
    subtitle: "Manage customer orders",
    type: "navigation", 
    category: "navigation",
    url: "/sales/orders",
    icon: ShoppingCart,
  },
  {
    id: "nav-sales-invoices",
    title: "Sales Invoices",
    subtitle: "Invoice management",
    type: "navigation",
    category: "navigation", 
    url: "/sales/invoices",
    icon: FileText,
  },
  {
    id: "nav-sales-receipts",
    title: "Sales Receipts",
    subtitle: "Payment receipts",
    type: "navigation",
    category: "navigation",
    url: "/sales/receipts", 
    icon: Receipt,
  },
  {
    id: "nav-sales-returns",
    title: "Sales Returns",
    subtitle: "Return management",
    type: "navigation",
    category: "navigation",
    url: "/sales/returns",
    icon: RotateCcw,
  },
  {
    id: "nav-customer-ledger",
    title: "Customer Ledger",
    subtitle: "Customer account history",
    type: "navigation",
    category: "navigation",
    url: "/ledger/customers",
    icon: BookOpen,
  },
  {
    id: "nav-stock-ledger",
    title: "Stock Ledger", 
    subtitle: "Item movement history",
    type: "navigation",
    category: "navigation",
    url: "/ledger/items",
    icon: Package,
  },
  {
    id: "nav-stock-journal",
    title: "Stock Journal",
    subtitle: "Manual stock adjustments",
    type: "navigation",
    category: "navigation", 
    url: "/ledger/stock-journal",
    icon: ClipboardList,
  },
  {
    id: "nav-customers",
    title: "Customers",
    subtitle: "Customer management",
    type: "navigation",
    category: "navigation",
    url: "/masters/customers",
    icon: Users,
  },
  {
    id: "nav-vendors",
    title: "Vendors",
    subtitle: "Vendor management", 
    type: "navigation",
    category: "navigation",
    url: "/masters/vendors",
    icon: Building2,
  },
  {
    id: "nav-items",
    title: "Items",
    subtitle: "Product catalog",
    type: "navigation",
    category: "navigation",
    url: "/masters/items",
    icon: Package,
  },
  {
    id: "nav-brands",
    title: "Brands",
    subtitle: "Brand management",
    type: "navigation",
    category: "navigation",
    url: "/masters/items/brands",
    icon: Tag,
  },
  {
    id: "nav-sub-brands",
    title: "Sub-brands", 
    subtitle: "Sub-brand management",
    type: "navigation",
    category: "navigation",
    url: "/masters/items/sub-brands",
    icon: Layers,
  },
];

export function GlobalSearch({ placeholder = "Search anything...", className }: GlobalSearchProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const debouncedQuery = useDebounce(query, 300);

  // Fetch dynamic data based on search query
  const { data: customersData } = useSWR(
    debouncedQuery.length >= 2 ? `/api/customers?search=${encodeURIComponent(debouncedQuery)}&limit=5` : null
  );
  const { data: vendorsData } = useSWR(
    debouncedQuery.length >= 2 ? `/api/vendors?search=${encodeURIComponent(debouncedQuery)}&limit=5` : null
  );
  const { data: itemsData } = useSWR(
    debouncedQuery.length >= 2 ? `/api/items?search=${encodeURIComponent(debouncedQuery)}&limit=5` : null
  );
  const { data: ordersData } = useSWR(
    debouncedQuery.length >= 2 ? `/api/sales-orders?search=${encodeURIComponent(debouncedQuery)}&limit=5` : null
  );
  const { data: journalsData } = useSWR(
    debouncedQuery.length >= 2 ? `/api/stock-journals?search=${encodeURIComponent(debouncedQuery)}&limit=5` : null
  );

  // Combine all search results
  const searchResults = useMemo(() => {
    const results: SearchResult[] = [];

    // Always include navigation items if they match
    if (debouncedQuery.length >= 1) {
      const matchingNav = NAVIGATION_ITEMS.filter(item =>
        item.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        item.subtitle?.toLowerCase().includes(debouncedQuery.toLowerCase())
      );
      results.push(...matchingNav);
    }

    // Add dynamic results if query is long enough
    if (debouncedQuery.length >= 2) {
      // Customers
      if (customersData?.customers) {
        const customerResults: SearchResult[] = customersData.customers.map((customer: { id: string; name: string; customerNumber: string; email?: string; phone?: string; city?: string; state?: string; gstin?: string }) => ({
          id: `customer-${customer.id}`,
          title: customer.name,
          subtitle: customer.customerNumber,
          description: customer.city ? `${customer.city}, ${customer.state}` : undefined,
          type: "customer",
          category: "customers",
          url: `/masters/customers/${customer.id}`,
          icon: Users,
          metadata: { gstin: customer.gstin },
        }));
        results.push(...customerResults);
      }

      // Vendors
      if (vendorsData?.vendors) {
        const vendorResults: SearchResult[] = vendorsData.vendors.map((vendor: { id: string; name: string; vendorNumber: string; email?: string; phone?: string; city?: string; state?: string; gstin?: string }) => ({
          id: `vendor-${vendor.id}`,
          title: vendor.name,
          subtitle: vendor.vendorNumber,
          description: vendor.city ? `${vendor.city}, ${vendor.state}` : undefined,
          type: "vendor",
          category: "vendors",
          url: `/masters/vendors/${vendor.id}`,
          icon: Building2,
          metadata: { gstin: vendor.gstin },
        }));
        results.push(...vendorResults);
      }

      // Items
      if (itemsData?.items) {
        const itemResults: SearchResult[] = itemsData.items.map((item: { 
          id: string; 
          name: string; 
          itemCode: string; 
          description?: string; 
          brand?: { name: string }; 
          subBrand?: { name: string };
          unit?: string;
          standardPrice?: number;
          inventory?: { physicalStock?: number };
        }) => ({
          id: `item-${item.id}`,
          title: item.name,
          subtitle: item.itemCode,
          description: item.brand?.name ? `Brand: ${item.brand.name}` : undefined,
          type: "item",
          category: "items",
          url: `/masters/items/${item.id}`,
          icon: Package,
          metadata: { 
            unit: item.unit,
            price: item.standardPrice,
            stock: item.inventory?.physicalStock 
          },
        }));
        results.push(...itemResults);
      }

      // Sales Orders
      if (ordersData?.salesOrders) {
        const orderResults: SearchResult[] = ordersData.salesOrders.map((order: { id: string; orderNumber: string; orderDate: string; customer: { name: string }; totalAmount: number; status: string }) => ({
          id: `order-${order.id}`,
          title: order.orderNumber,
          subtitle: order.customer.name,
          description: `₹${Number(order.totalAmount).toFixed(2)} • ${order.status}`,
          type: "order",
          category: "orders",
          url: `/sales/orders/${order.id}`,
          icon: ShoppingCart,
          metadata: { 
            status: order.status,
            amount: order.totalAmount,
            date: order.orderDate 
          },
        }));
        results.push(...orderResults);
      }

      // Stock Journals
      if (journalsData?.journals) {
        const journalResults: SearchResult[] = journalsData.journals.map((journal: { id: string; journalNumber: string; date: string; type: string; quantity: number; reason?: string }) => ({
          id: `journal-${journal.id}`,
          title: journal.journalNumber,
          subtitle: journal.item?.name || "Unknown Item",
          description: `${journal.type} • ${Number(journal.quantity).toFixed(3)} ${journal.item?.unit || ""}`,
          type: "journal",
          category: "journals",
          url: `/ledger/stock-journal`,
          icon: ClipboardList,
          metadata: { 
            type: journal.type,
            quantity: journal.quantity,
            date: journal.date 
          },
        }));
        results.push(...journalResults);
      }
    }

    return results;
  }, [debouncedQuery, customersData, vendorsData, itemsData, ordersData, journalsData]);

  // Group results by category
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    
    searchResults.forEach(result => {
      if (!groups[result.category]) {
        groups[result.category] = [];
      }
      groups[result.category].push(result);
    });

    return groups;
  }, [searchResults]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      
      // Escape to close
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery("");
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    router.push(result.url);
  };

  const formatMetadata = (result: SearchResult) => {
    if (!result.metadata) return null;
    
    const items = [];
    if (result.metadata.stock !== undefined) {
      items.push(`Stock: ${result.metadata.stock}`);
    }
    if (result.metadata.price !== undefined) {
      items.push(`₹${Number(result.metadata.price).toFixed(2)}`);
    }
    if (result.metadata.gstin) {
      items.push(`GSTIN: ${result.metadata.gstin}`);
    }
    
    return items.length > 0 ? items.join(" • ") : null;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`w-full justify-start text-sm text-muted-foreground ${className}`}
          onClick={() => setOpen(true)}
        >
          <Search className="mr-2 h-4 w-4" />
          {placeholder}
          <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[600px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            ref={inputRef}
            placeholder="Search customers, items, orders, navigation..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[400px]">
            {isLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
              </div>
            )}
            
            {!isLoading && Object.keys(groupedResults).length === 0 && query.length > 0 && (
              <CommandEmpty>No results found for &quot;{query}&quot;</CommandEmpty>
            )}

            {!isLoading && query.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                <Search className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p>Start typing to search across your inventory system</p>
                <p className="text-xs mt-1">Search customers, items, orders, and more...</p>
                
                {/* Quick search examples */}
                <div className="mt-4 text-left max-w-sm mx-auto">
                  <p className="text-xs font-medium mb-2">Try searching for:</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <Users className="h-3 w-3 text-gray-400" />
                      <span>Customer names, phone numbers</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Package className="h-3 w-3 text-gray-400" />
                      <span>Item codes, product names</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-3 w-3 text-gray-400" />
                      <span>Order numbers (SO-0001)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isLoading && Object.entries(groupedResults).map(([category, results]) => (
              <CommandGroup key={category} heading={SEARCH_CATEGORIES[category as keyof typeof SEARCH_CATEGORIES] || category}>
                {results.map((result) => {
                  const Icon = result.icon;
                  const metadata = formatMetadata(result);
                  
                  return (
                    <CommandItem
                      key={result.id}
                      value={`${result.title} ${result.subtitle} ${result.description}`}
                      onSelect={() => handleSelect(result)}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{result.title}</span>
                          {result.subtitle && (
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {result.subtitle}
                            </span>
                          )}
                        </div>
                        {(result.description || metadata) && (
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            {result.description}
                            {result.description && metadata && " • "}
                            {metadata}
                          </div>
                        )}
                      </div>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </CommandItem>
                  );
                })}
                
                {/* Show "View All Results" for each category if there are results */}
                {results.length > 0 && (
                  <CommandItem
                    value={`view all ${category} results`}
                    onSelect={() => {
                      setOpen(false);
                      setQuery("");
                      router.push(`/search?q=${encodeURIComponent(query)}`);
                    }}
                    className="flex items-center gap-3 px-4 py-2 text-teal-600 hover:text-teal-700 border-t border-gray-100 mt-1"
                  >
                    <Search className="h-4 w-4" />
                    <span className="text-sm font-medium">View all {category} results</span>
                    <ArrowRight className="h-3 w-3 ml-auto" />
                  </CommandItem>
                )}
              </CommandGroup>
            ))}

            {/* Global "View All Results" if there are any results */}
            {!isLoading && Object.keys(groupedResults).length > 0 && (
              <CommandGroup>
                <CommandItem
                  value="view all search results"
                  onSelect={() => {
                    setOpen(false);
                    setQuery("");
                    router.push(`/search?q=${encodeURIComponent(query)}`);
                  }}
                  className="flex items-center gap-3 px-4 py-3 text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 border-t-2 border-teal-200"
                >
                  <Search className="h-4 w-4" />
                  <span className="font-medium">View all search results for &quot;{query}&quot;</span>
                  <ArrowRight className="h-3 w-3 ml-auto" />
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}