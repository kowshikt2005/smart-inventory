"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Search,
  Users,
  Package,
  ShoppingCart,
  FileText,
  Building2,
  ClipboardList,
  Loader2,
  ExternalLink,
  X,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebounce } from "@/hooks/useDebounce";
import useSWR from "swr";

interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  type: string;
  url: string;
  metadata?: Record<string, any>;
}

const SEARCH_TABS = [
  { id: "all", label: "All Results", icon: Search },
  { id: "customers", label: "Customers", icon: Users },
  { id: "vendors", label: "Vendors", icon: Building2 },
  { id: "items", label: "Items", icon: Package },
  { id: "orders", label: "Orders", icon: ShoppingCart },
  { id: "journals", label: "Journals", icon: ClipboardList },
];

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState("all");
  const debouncedQuery = useDebounce(query, 300);

  // Update URL when query changes
  useEffect(() => {
    if (debouncedQuery) {
      const params = new URLSearchParams();
      params.set("q", debouncedQuery);
      router.replace(`/search?${params.toString()}`);
    }
  }, [debouncedQuery, router]);

  // Fetch search results from different APIs
  const { data: customersData, isLoading: loadingCustomers } = useSWR(
    debouncedQuery.length >= 2 ? `/api/customers?search=${encodeURIComponent(debouncedQuery)}&limit=20` : null
  );
  const { data: vendorsData, isLoading: loadingVendors } = useSWR(
    debouncedQuery.length >= 2 ? `/api/vendors?search=${encodeURIComponent(debouncedQuery)}&limit=20` : null
  );
  const { data: itemsData, isLoading: loadingItems } = useSWR(
    debouncedQuery.length >= 2 ? `/api/items?search=${encodeURIComponent(debouncedQuery)}&limit=20` : null
  );
  const { data: ordersData, isLoading: loadingOrders } = useSWR(
    debouncedQuery.length >= 2 ? `/api/sales-orders?search=${encodeURIComponent(debouncedQuery)}&limit=20` : null
  );
  const { data: journalsData, isLoading: loadingJournals } = useSWR(
    debouncedQuery.length >= 2 ? `/api/stock-journals?search=${encodeURIComponent(debouncedQuery)}&limit=20` : null
  );

  const isLoading = loadingCustomers || loadingVendors || loadingItems || loadingOrders || loadingJournals;

  // Process search results
  const searchResults = useMemo(() => {
    const results: { [key: string]: SearchResultItem[] } = {
      customers: [],
      vendors: [],
      items: [],
      orders: [],
      journals: [],
    };

    if (customersData?.customers) {
      results.customers = customersData.customers.map((customer: any) => ({
        id: customer.id,
        title: customer.name,
        subtitle: customer.customerNumber,
        description: customer.city ? `${customer.city}, ${customer.state}` : undefined,
        type: "customer",
        url: `/masters/customers/${customer.id}`,
        metadata: { gstin: customer.gstin, phone: customer.phone },
      }));
    }

    if (vendorsData?.vendors) {
      results.vendors = vendorsData.vendors.map((vendor: any) => ({
        id: vendor.id,
        title: vendor.name,
        subtitle: vendor.vendorNumber,
        description: vendor.city ? `${vendor.city}, ${vendor.state}` : undefined,
        type: "vendor",
        url: `/masters/vendors/${vendor.id}`,
        metadata: { gstin: vendor.gstin, phone: vendor.phone },
      }));
    }

    if (itemsData?.items) {
      results.items = itemsData.items.map((item: any) => ({
        id: item.id,
        title: item.name,
        subtitle: item.itemCode,
        description: item.brand?.name ? `Brand: ${item.brand.name}` : undefined,
        type: "item",
        url: `/masters/items/${item.id}`,
        metadata: { 
          unit: item.unit,
          price: item.standardPrice,
          stock: item.inventory?.physicalStock 
        },
      }));
    }

    if (ordersData?.salesOrders) {
      results.orders = ordersData.salesOrders.map((order: any) => ({
        id: order.id,
        title: order.orderNumber,
        subtitle: order.customer.name,
        description: `₹${Number(order.totalAmount).toFixed(2)} • ${order.status}`,
        type: "order",
        url: `/sales/orders/${order.id}`,
        metadata: { 
          status: order.status,
          amount: order.totalAmount,
          date: order.orderDate 
        },
      }));
    }

    if (journalsData?.journals) {
      results.journals = journalsData.journals.map((journal: any) => ({
        id: journal.id,
        title: journal.journalNumber,
        subtitle: journal.item?.name || "Unknown Item",
        description: `${journal.type} • ${Number(journal.quantity).toFixed(3)} ${journal.item?.unit || ""}`,
        type: "journal",
        url: `/ledger/stock-journal`,
        metadata: { 
          type: journal.type,
          quantity: journal.quantity,
          date: journal.date 
        },
      }));
    }

    return results;
  }, [customersData, vendorsData, itemsData, ordersData, journalsData]);

  const allResults = useMemo(() => {
    return Object.values(searchResults).flat();
  }, [searchResults]);

  const getResultsForTab = (tabId: string) => {
    if (tabId === "all") return allResults;
    return searchResults[tabId] || [];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getTabIcon = (tabId: string) => {
    const tab = SEARCH_TABS.find(t => t.id === tabId);
    return tab?.icon || Search;
  };

  const getResultCount = (tabId: string) => {
    return getResultsForTab(tabId).length;
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Search Results</h1>
          <p className="text-gray-600">Find anything across your inventory system</p>
        </div>

        {/* Search Input */}
        <div className="mb-6">
          <div className="relative max-w-2xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search customers, items, orders, and more..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 pr-10 h-12 text-lg"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        {debouncedQuery.length < 2 ? (
          <div className="text-center py-16 text-gray-500">
            <Search className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">Start searching</h3>
            <p>Enter at least 2 characters to search across your inventory system</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-6">
              {SEARCH_TABS.map((tab) => {
                const Icon = tab.icon;
                const count = getResultCount(tab.id);
                return (
                  <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                    {count > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {count}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {SEARCH_TABS.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="mt-6">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
                    <span className="ml-3 text-gray-600">Searching...</span>
                  </div>
                ) : (
                  <SearchResultsTable 
                    results={getResultsForTab(tab.id)}
                    query={debouncedQuery}
                    onNavigate={(url) => router.push(url)}
                  />
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}

interface SearchResultsTableProps {
  results: SearchResultItem[];
  query: string;
  onNavigate: (url: string) => void;
}

function SearchResultsTable({ results, query, onNavigate }: SearchResultsTableProps) {
  if (results.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium mb-2">No results found</h3>
        <p>No items match your search for "{query}"</p>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="font-semibold">Title</TableHead>
            <TableHead className="font-semibold">Code/Number</TableHead>
            <TableHead className="font-semibold">Description</TableHead>
            <TableHead className="font-semibold">Type</TableHead>
            <TableHead className="font-semibold">Details</TableHead>
            <TableHead className="font-semibold">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((result) => (
            <TableRow key={result.id} className="hover:bg-gray-50">
              <TableCell className="font-medium">{result.title}</TableCell>
              <TableCell className="font-mono text-sm">{result.subtitle || "-"}</TableCell>
              <TableCell className="text-sm text-gray-600">{result.description || "-"}</TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {result.type}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-gray-600">
                {result.metadata && (
                  <div className="space-y-1">
                    {result.metadata.stock !== undefined && (
                      <div>Stock: {result.metadata.stock}</div>
                    )}
                    {result.metadata.price !== undefined && (
                      <div>Price: {formatCurrency(Number(result.metadata.price))}</div>
                    )}
                    {result.metadata.amount !== undefined && (
                      <div>Amount: {formatCurrency(Number(result.metadata.amount))}</div>
                    )}
                    {result.metadata.status && (
                      <div>Status: {result.metadata.status}</div>
                    )}
                    {result.metadata.gstin && (
                      <div>GSTIN: {result.metadata.gstin}</div>
                    )}
                    {result.metadata.phone && (
                      <div>Phone: {result.metadata.phone}</div>
                    )}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate(result.url)}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-3 w-3" />
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}