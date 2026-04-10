"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, TrendingUp, X, LayoutList, BarChart3, Package } from "lucide-react";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { exportToExcel, exportToPDF, fmtNum, fmtDateExport, fetchCompanySettings } from "@/lib/export-utils";
import { useState, useMemo } from "react";
import useSWR from "swr";

interface ProfitRecord {
  date: string;
  invoiceNumber: string;
  invoiceId: string;
  customerId: string;
  customer: string;
  brandId: string | null;
  brand: string;
  subBrand: string;
  productId: string;
  productName: string;
  itemCode: string;
  qty: number;
  taxRate: number;
  soldRateExclGST: number;
  soldRateInclGST: number;
  purchasePriceExclGST: number;
  purchasePriceInclGST: number;
  soldAmountInclGST: number;
  purchaseAmountInclGST: number;
  grossMargin: number;
  marginPct: number;
}

type ViewMode = "item" | "brand" | "product";

export default function ProfitReportPage() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const [filters, setFilters] = useState({
    startDate: firstDay,
    endDate: lastDay,
    brandId: "all",
    customerId: "all",
    productId: "all",
  });
  const [viewMode, setViewMode] = useState<ViewMode>("item");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const { data: customersData } = useSWR("/api/customers?limit=1000");
  const { data: brandsData } = useSWR("/api/brands");
  const { data: itemsData } = useSWR("/api/items?limit=9999");

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.startDate) p.append("startDate", filters.startDate);
    if (filters.endDate) p.append("endDate", filters.endDate);
    if (filters.brandId !== "all") p.append("brandId", filters.brandId);
    if (filters.customerId !== "all") p.append("customerId", filters.customerId);
    if (filters.productId !== "all") p.append("productId", filters.productId);
    return p.toString();
  }, [filters]);

  const { data, error, isLoading } = useSWR(
    `/api/reports/profit-report?${queryString}`,
    { revalidateIfStale: false }
  );

  const records: ProfitRecord[] = useMemo(() => data?.records || [], [data]);
  const summary = data?.summary;

  // ── Aggregations (client-side) ──────────────────────────────

  const brandWise = useMemo(() => {
    const map = new Map<string, {
      brandId: string | null; brand: string;
      products: Set<string>; invoices: Set<string>;
      totalQty: number; soldAmount: number; purchaseAmount: number;
    }>();
    for (const r of records) {
      const key = r.brandId || "__none__";
      if (!map.has(key)) {
        map.set(key, { brandId: r.brandId, brand: r.brand, products: new Set(), invoices: new Set(), totalQty: 0, soldAmount: 0, purchaseAmount: 0 });
      }
      const e = map.get(key)!;
      e.products.add(r.productId);
      e.invoices.add(r.invoiceId);
      e.totalQty += r.qty;
      e.soldAmount += r.soldAmountInclGST;
      e.purchaseAmount += r.purchaseAmountInclGST;
    }
    return Array.from(map.values())
      .map((e) => ({
        ...e,
        productCount: e.products.size,
        invoiceCount: e.invoices.size,
        grossMargin: e.purchaseAmount - e.soldAmount,
        marginPct: e.soldAmount > 0 ? ((e.purchaseAmount - e.soldAmount) / e.soldAmount) * 100 : 0,
      }))
      .sort((a, b) => b.grossMargin - a.grossMargin);
  }, [records]);

  const productWise = useMemo(() => {
    const map = new Map<string, {
      productId: string; productName: string; brand: string;
      invoices: Set<string>; totalQty: number;
      soldAmount: number; purchaseAmount: number;
      purchasePriceInclGST: number; // for avg
    }>();
    for (const r of records) {
      if (!map.has(r.productId)) {
        map.set(r.productId, { productId: r.productId, productName: r.productName, brand: r.brand, invoices: new Set(), totalQty: 0, soldAmount: 0, purchaseAmount: 0, purchasePriceInclGST: r.purchasePriceInclGST });
      }
      const e = map.get(r.productId)!;
      e.invoices.add(r.invoiceId);
      e.totalQty += r.qty;
      e.soldAmount += r.soldAmountInclGST;
      e.purchaseAmount += r.purchaseAmountInclGST;
    }
    return Array.from(map.values())
      .map((e) => ({
        ...e,
        invoiceCount: e.invoices.size,
        avgSoldRateInclGST: e.totalQty > 0 ? e.soldAmount / e.totalQty : 0,
        grossMargin: e.purchaseAmount - e.soldAmount,
        marginPct: e.soldAmount > 0 ? ((e.purchaseAmount - e.soldAmount) / e.soldAmount) * 100 : 0,
      }))
      .sort((a, b) => b.grossMargin - a.grossMargin);
  }, [records]);

  // Pagination for item-wise
  const totalPages = Math.ceil(records.length / itemsPerPage);
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return records.slice(start, start + itemsPerPage);
  }, [records, currentPage, itemsPerPage]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilter = (key: string) => {
    const defaults: Record<string, string> = { startDate: firstDay, endDate: lastDay, brandId: "all", customerId: "all", productId: "all" };
    handleFilterChange(key, defaults[key]);
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(n);

  const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

  const marginClass = (v: number) =>
    v > 0 ? "text-green-600" : v < 0 ? "text-red-600" : "text-gray-500";

  const handleExportExcel = async () => {
    const { company } = await fetchCompanySettings();
    if (viewMode === "brand") {
      const headers = ["Brand", "Products", "Invoices", "Total Qty", "Sold Amount (incl GST)", "Purchase Amount (incl GST)", "Gross Margin", "Margin %"];
      const rows = brandWise.map((b) => [b.brand, b.productCount, b.invoiceCount, b.totalQty, b.soldAmount, b.purchaseAmount, b.grossMargin, b.marginPct.toFixed(1) + "%"]);
      exportToExcel({ fileName: `Profit-Report-Brand-Wise_${fmtDateExport(filters.startDate)}_to_${fmtDateExport(filters.endDate)}.xlsx`, sheets: [{ name: "Brand-Wise Profit", headers, rows }], company });
    } else if (viewMode === "product") {
      const headers = ["Product", "Brand", "Invoices", "Total Qty", "Purchase Price (incl GST)", "Avg Sold Rate (incl GST)", "Sold Amount (incl GST)", "Purchase Amount (incl GST)", "Gross Margin", "Margin %"];
      const rows = productWise.map((p) => [p.productName, p.brand, p.invoiceCount, p.totalQty, p.purchasePriceInclGST, p.avgSoldRateInclGST, p.soldAmount, p.purchaseAmount, p.grossMargin, p.marginPct.toFixed(1) + "%"]);
      exportToExcel({ fileName: `Profit-Report-Product-Wise_${fmtDateExport(filters.startDate)}_to_${fmtDateExport(filters.endDate)}.xlsx`, sheets: [{ name: "Product-Wise Profit", headers, rows }], company });
    } else {
      const headers = ["Date", "Invoice No", "Customer", "Brand", "Product", "Qty", "Purchase Price (incl GST)", "Sold Rate (incl GST)", "Purchase Amount", "Sold Amount", "Gross Margin", "Margin %"];
      const rows = records.map((r) => [fmtDateExport(r.date), r.invoiceNumber, r.customer, r.brand, r.productName, r.qty, r.purchasePriceInclGST, r.soldRateInclGST, r.purchaseAmountInclGST, r.soldAmountInclGST, r.grossMargin, r.marginPct.toFixed(1) + "%"]);
      exportToExcel({ fileName: `Profit-Report_${fmtDateExport(filters.startDate)}_to_${fmtDateExport(filters.endDate)}.xlsx`, sheets: [{ name: "Profit Report", headers, rows }], company });
    }
  };

  const handleExportPDF = async () => {
    const { company } = await fetchCompanySettings();
    if (viewMode === "brand") {
      const headers = ["Brand", "Products", "Invoices", "Sold Amount", "Purchase Amount", "Gross Margin", "Margin %"];
      const rows = brandWise.map((b) => [b.brand, b.productCount, b.invoiceCount, fmtNum(b.soldAmount), fmtNum(b.purchaseAmount), fmtNum(b.grossMargin), b.marginPct.toFixed(1) + "%"]);
      exportToPDF({ fileName: `Profit-Report-Brand-Wise_${fmtDateExport(filters.startDate)}_to_${fmtDateExport(filters.endDate)}.pdf`, title: "Profit Report (Brand-wise)", subtitle: `${fmtDateExport(filters.startDate)} to ${fmtDateExport(filters.endDate)}`, orientation: "landscape", sheets: [{ name: "Brand Profit", headers, rows }], company });
    } else if (viewMode === "product") {
      const headers = ["Product", "Brand", "Qty", "Purchase Price", "Avg Sold Rate", "Gross Margin", "Margin %"];
      const rows = productWise.map((p) => [p.productName, p.brand, p.totalQty, fmtNum(p.purchasePriceInclGST), fmtNum(p.avgSoldRateInclGST), fmtNum(p.grossMargin), p.marginPct.toFixed(1) + "%"]);
      exportToPDF({ fileName: `Profit-Report-Product-Wise_${fmtDateExport(filters.startDate)}_to_${fmtDateExport(filters.endDate)}.pdf`, title: "Profit Report (Product-wise)", subtitle: `${fmtDateExport(filters.startDate)} to ${fmtDateExport(filters.endDate)}`, orientation: "landscape", sheets: [{ name: "Product Profit", headers, rows }], company });
    } else {
      const headers = ["Date", "Invoice", "Customer", "Brand", "Product", "Qty", "Purchase Amt", "Sold Amt", "Margin", "Margin %"];
      const rows = records.map((r) => [fmtDateExport(r.date), r.invoiceNumber, r.customer, r.brand, r.productName, r.qty, fmtNum(r.purchaseAmountInclGST), fmtNum(r.soldAmountInclGST), fmtNum(r.grossMargin), r.marginPct.toFixed(1) + "%"]);
      exportToPDF({ fileName: `Profit-Report_${fmtDateExport(filters.startDate)}_to_${fmtDateExport(filters.endDate)}.pdf`, title: "Profit Report (Item-wise)", subtitle: `${fmtDateExport(filters.startDate)} to ${fmtDateExport(filters.endDate)}`, orientation: "landscape", sheets: [{ name: "Profit", headers, rows }], company });
    }
  };

  const VIEW_MODES: { value: ViewMode; label: string; icon: typeof LayoutList }[] = [
    { value: "item", label: "Item-wise", icon: LayoutList },
    { value: "brand", label: "Brand-wise", icon: BarChart3 },
    { value: "product", label: "Product-wise", icon: Package },
  ];

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-green-600" />
              <h1 className="text-2xl font-bold text-gray-900">Profit Report</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* View mode toggle */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {VIEW_MODES.map(({ value, label, icon: Icon }, i) => (
                  <Button
                    key={value}
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode(value)}
                    className={`rounded-none gap-1.5 ${i > 0 ? "border-l" : ""} ${viewMode === value ? "bg-green-600 text-white hover:bg-green-700" : "hover:bg-gray-50"}`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Button>
                ))}
              </div>
              <ExportButtons onExportPDF={handleExportPDF} onExportExcel={handleExportExcel} disabled={isLoading || records.length === 0} />
            </div>
          </div>
          <p className="text-gray-600 text-sm">
            Gross margin = Purchase Amount (incl. GST) − Sold Amount (incl. GST)
          </p>
        </div>

        {/* Summary Cards */}
        {!isLoading && summary && records.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Sold Amount (incl. GST)</p>
              <p className="text-lg font-bold text-gray-900">{fmt(summary.totalSoldAmount)}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Purchase Cost (incl. GST)</p>
              <p className="text-lg font-bold text-gray-900">{fmt(summary.totalPurchaseAmount)}</p>
            </div>
            <div className={`rounded-lg border p-4 ${summary.totalGrossMargin >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <p className="text-xs text-gray-500 mb-1">Gross Margin</p>
              <p className={`text-lg font-bold ${summary.totalGrossMargin >= 0 ? "text-green-700" : "text-red-700"}`}>
                {fmt(summary.totalGrossMargin)}
              </p>
            </div>
            <div className={`rounded-lg border p-4 ${summary.overallMarginPct >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <p className="text-xs text-gray-500 mb-1">Overall Margin %</p>
              <p className={`text-lg font-bold ${summary.overallMarginPct >= 0 ? "text-green-700" : "text-red-700"}`}>
                {fmtPct(summary.overallMarginPct)}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {/* Start Date */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Start Date</Label>
                {filters.startDate !== firstDay && (
                  <button onClick={() => clearFilter("startDate")} className="text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>
                )}
              </div>
              <Input type="date" value={filters.startDate} onChange={(e) => handleFilterChange("startDate", e.target.value)} className="h-9" />
            </div>

            {/* End Date */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">End Date</Label>
                {filters.endDate !== lastDay && (
                  <button onClick={() => clearFilter("endDate")} className="text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>
                )}
              </div>
              <Input type="date" value={filters.endDate} onChange={(e) => handleFilterChange("endDate", e.target.value)} className="h-9" />
            </div>

            {/* Brand */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Brand</Label>
                {filters.brandId !== "all" && (
                  <button onClick={() => clearFilter("brandId")} className="text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>
                )}
              </div>
              <Select value={filters.brandId} onValueChange={(v) => handleFilterChange("brandId", v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="All Brands" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  {brandsData?.brands?.map((b: { id: string; name: string }) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Customer */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Customer</Label>
                {filters.customerId !== "all" && (
                  <button onClick={() => clearFilter("customerId")} className="text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>
                )}
              </div>
              <Select value={filters.customerId} onValueChange={(v) => handleFilterChange("customerId", v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="All Customers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customersData?.customers?.map((c: { id: string; name: string }) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Product */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Product</Label>
                {filters.productId !== "all" && (
                  <button onClick={() => clearFilter("productId")} className="text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>
                )}
              </div>
              <Select value={filters.productId} onValueChange={(v) => handleFilterChange("productId", v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="All Products" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {itemsData?.items?.map((it: { id: string; name: string }) => (
                    <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="text-center py-12 flex items-center justify-center gap-2 text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading profit report...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600">Error loading report</div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No data found for the selected filters</div>
          ) : viewMode === "brand" ? (
            // ── Brand-wise ─────────────────────────────────
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Brand</TableHead>
                    <TableHead className="font-semibold text-right">Products</TableHead>
                    <TableHead className="font-semibold text-right">Invoices</TableHead>
                    <TableHead className="font-semibold text-right">Total Qty</TableHead>
                    <TableHead className="font-semibold text-right">Sold Amount</TableHead>
                    <TableHead className="font-semibold text-right">Purchase Amount</TableHead>
                    <TableHead className="font-semibold text-right">Gross Margin</TableHead>
                    <TableHead className="font-semibold text-right">Margin %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brandWise.map((b, i) => (
                    <TableRow key={b.brandId || i} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{b.brand}</TableCell>
                      <TableCell className="text-right">{b.productCount}</TableCell>
                      <TableCell className="text-right">{b.invoiceCount}</TableCell>
                      <TableCell className="text-right">{b.totalQty.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{fmt(b.soldAmount)}</TableCell>
                      <TableCell className="text-right">{fmt(b.purchaseAmount)}</TableCell>
                      <TableCell className={`text-right font-semibold ${marginClass(b.grossMargin)}`}>{fmt(b.grossMargin)}</TableCell>
                      <TableCell className={`text-right font-medium ${marginClass(b.marginPct)}`}>{fmtPct(b.marginPct)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-gray-50 font-semibold border-t-2">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{brandWise.reduce((s, b) => s + b.productCount, 0)}</TableCell>
                    <TableCell className="text-right">{new Set(records.map((r) => r.invoiceId)).size}</TableCell>
                    <TableCell className="text-right">{brandWise.reduce((s, b) => s + b.totalQty, 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{fmt(summary?.totalSoldAmount ?? 0)}</TableCell>
                    <TableCell className="text-right">{fmt(summary?.totalPurchaseAmount ?? 0)}</TableCell>
                    <TableCell className={`text-right ${marginClass(summary?.totalGrossMargin ?? 0)}`}>{fmt(summary?.totalGrossMargin ?? 0)}</TableCell>
                    <TableCell className={`text-right ${marginClass(summary?.overallMarginPct ?? 0)}`}>{fmtPct(summary?.overallMarginPct ?? 0)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : viewMode === "product" ? (
            // ── Product-wise ────────────────────────────────
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Product</TableHead>
                    <TableHead className="font-semibold">Brand</TableHead>
                    <TableHead className="font-semibold text-right">Invoices</TableHead>
                    <TableHead className="font-semibold text-right">Total Qty</TableHead>
                    <TableHead className="font-semibold text-right">Purchase Price (incl. GST)</TableHead>
                    <TableHead className="font-semibold text-right">Avg Sold Rate (incl. GST)</TableHead>
                    <TableHead className="font-semibold text-right">Sold Amount</TableHead>
                    <TableHead className="font-semibold text-right">Purchase Amount</TableHead>
                    <TableHead className="font-semibold text-right">Gross Margin</TableHead>
                    <TableHead className="font-semibold text-right">Margin %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productWise.map((p) => (
                    <TableRow key={p.productId} className="hover:bg-gray-50">
                      <TableCell>
                        <p className="font-medium">{p.productName}</p>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{p.brand}</TableCell>
                      <TableCell className="text-right">{p.invoiceCount}</TableCell>
                      <TableCell className="text-right">{p.totalQty.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{fmt(p.purchasePriceInclGST)}</TableCell>
                      <TableCell className="text-right">{fmt(p.avgSoldRateInclGST)}</TableCell>
                      <TableCell className="text-right">{fmt(p.soldAmount)}</TableCell>
                      <TableCell className="text-right">{fmt(p.purchaseAmount)}</TableCell>
                      <TableCell className={`text-right font-semibold ${marginClass(p.grossMargin)}`}>{fmt(p.grossMargin)}</TableCell>
                      <TableCell className={`text-right font-medium ${marginClass(p.marginPct)}`}>{fmtPct(p.marginPct)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-gray-50 font-semibold border-t-2">
                    <TableCell colSpan={6}>Total</TableCell>
                    <TableCell className="text-right">{fmt(summary?.totalSoldAmount ?? 0)}</TableCell>
                    <TableCell className="text-right">{fmt(summary?.totalPurchaseAmount ?? 0)}</TableCell>
                    <TableCell className={`text-right ${marginClass(summary?.totalGrossMargin ?? 0)}`}>{fmt(summary?.totalGrossMargin ?? 0)}</TableCell>
                    <TableCell className={`text-right ${marginClass(summary?.overallMarginPct ?? 0)}`}>{fmtPct(summary?.overallMarginPct ?? 0)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            // ── Item-wise ───────────────────────────────────
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Invoice No</TableHead>
                    <TableHead className="font-semibold">Customer</TableHead>
                    <TableHead className="font-semibold">Brand</TableHead>
                    <TableHead className="font-semibold">Product</TableHead>
                    <TableHead className="font-semibold text-right">Qty</TableHead>
                    <TableHead className="font-semibold text-right">Purchase Price<br /><span className="font-normal text-xs text-gray-400">(incl. GST)</span></TableHead>
                    <TableHead className="font-semibold text-right">Sold Rate<br /><span className="font-normal text-xs text-gray-400">(incl. GST)</span></TableHead>
                    <TableHead className="font-semibold text-right">Purchase Amt</TableHead>
                    <TableHead className="font-semibold text-right">Sold Amt</TableHead>
                    <TableHead className="font-semibold text-right">Gross Margin</TableHead>
                    <TableHead className="font-semibold text-right">Margin %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((r, idx) => (
                    <TableRow key={`${r.invoiceId}-${r.productId}-${idx}`} className="hover:bg-gray-50">
                      <TableCell className="text-sm">
                        {new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{r.invoiceNumber}</TableCell>
                      <TableCell className="text-sm">{r.customer}</TableCell>
                      <TableCell className="text-sm">{r.brand}</TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{r.productName}</p>
                        <p className="text-xs text-gray-400">{r.itemCode}</p>
                      </TableCell>
                      <TableCell className="text-right">{r.qty.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(r.purchasePriceInclGST)}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(r.soldRateInclGST)}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(r.purchaseAmountInclGST)}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(r.soldAmountInclGST)}</TableCell>
                      <TableCell className={`text-right font-semibold ${marginClass(r.grossMargin)}`}>{fmt(r.grossMargin)}</TableCell>
                      <TableCell className={`text-right font-medium ${marginClass(r.marginPct)}`}>{fmtPct(r.marginPct)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Pagination (item-wise only) */}
        {!isLoading && viewMode === "item" && records.length > 0 && totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, records.length)} of {records.length} records
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
              <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
            </div>
          </div>
        )}

        {/* Footer summary */}
        {!isLoading && records.length > 0 && (
          <div className="mt-4 text-sm text-gray-600 flex flex-wrap gap-4">
            <span>Records: <span className="font-semibold text-gray-900">{records.length}</span></span>
            <span>Sold: <span className="font-semibold text-gray-900">{fmt(summary?.totalSoldAmount ?? 0)}</span></span>
            <span>Cost: <span className="font-semibold text-gray-900">{fmt(summary?.totalPurchaseAmount ?? 0)}</span></span>
            <span>Margin: <span className={`font-semibold ${marginClass(summary?.totalGrossMargin ?? 0)}`}>{fmt(summary?.totalGrossMargin ?? 0)} ({fmtPct(summary?.overallMarginPct ?? 0)})</span></span>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
