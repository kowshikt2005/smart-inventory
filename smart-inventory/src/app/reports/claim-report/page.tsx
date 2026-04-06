"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, FileText, X, LayoutList, BarChart3 } from "lucide-react";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { exportToExcel, exportToPDF, generatePDFBase64, fmtNum, fmtDateExport, fetchCompanySettings } from "@/lib/export-utils";
import { EmailReportDialog } from "@/components/reports/EmailReportDialog";
import { useState, useMemo } from "react";
import useSWR from "swr";

interface ClaimRecord {
  date: string;
  invoiceNumber: string;
  invoiceId: string;
  brand: string;
  brandId: string | null;
  subBrand: string;
  subBrandId: string | null;
  customer: string;
  customerId: string;
  productName: string;
  productId: string;
  mrp: number;
  sellingPrice: number;
  basePrice: number;
  soldRate: number;
  quantity: number;
  unitClaim: number;
  totalClaim: number;
}

interface BrandWiseClaim {
  brandId: string | null;
  brand: string;
  productCount: number;
  invoiceCount: number;
  totalQuantity: number;
  totalClaim: number;
}

export default function ClaimReportPage() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const [filters, setFilters] = useState({
    startDate: firstDay,
    endDate: lastDay,
    brandId: "all",
    customerId: "all",
    productId: "all",
    hideZeroClaims: false,
    usePrice: "sellingPrice",
  });

  const [viewMode, setViewMode] = useState<"item" | "brand">("item");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const { data: customersData } = useSWR("/api/customers?limit=1000");
  const { data: brandsData } = useSWR("/api/brands");
  const { data: itemsData } = useSWR("/api/items?limit=9999");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.startDate) params.append("startDate", filters.startDate);
    if (filters.endDate) params.append("endDate", filters.endDate);
    if (filters.brandId && filters.brandId !== "all") params.append("brandId", filters.brandId);
    if (filters.customerId && filters.customerId !== "all") params.append("customerId", filters.customerId);
    if (filters.productId && filters.productId !== "all") params.append("productId", filters.productId);
    if (filters.hideZeroClaims) params.append("hideZeroClaims", "true");
    params.append("usePrice", filters.usePrice);
    return params.toString();
  }, [filters]);

  const { data, error, isLoading } = useSWR(
    `/api/reports/claim-report?${queryString}`,
    { revalidateIfStale: false }
  );

  const claims: ClaimRecord[] = useMemo(() => data?.claims || [], [data]);

  // Brand-wise aggregation (client-side from existing data)
  const brandWiseClaims: BrandWiseClaim[] = useMemo(() => {
    const brandMap = new Map<string, {
      brandId: string | null;
      brand: string;
      products: Set<string>;
      invoices: Set<string>;
      totalQuantity: number;
      totalClaim: number;
    }>();

    for (const claim of claims) {
      const key = claim.brandId || "__no_brand__";
      if (!brandMap.has(key)) {
        brandMap.set(key, {
          brandId: claim.brandId,
          brand: claim.brand,
          products: new Set(),
          invoices: new Set(),
          totalQuantity: 0,
          totalClaim: 0,
        });
      }
      const entry = brandMap.get(key)!;
      entry.products.add(claim.productId);
      entry.invoices.add(claim.invoiceId);
      entry.totalQuantity += claim.quantity;
      entry.totalClaim += claim.totalClaim;
    }

    return Array.from(brandMap.values())
      .map((e) => ({
        brandId: e.brandId,
        brand: e.brand,
        productCount: e.products.size,
        invoiceCount: e.invoices.size,
        totalQuantity: e.totalQuantity,
        totalClaim: e.totalClaim,
      }))
      .sort((a, b) => b.totalClaim - a.totalClaim);
  }, [claims]);

  // Paginate item-wise claims
  const totalPages = Math.ceil(claims.length / itemsPerPage);
  const paginatedClaims = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return claims.slice(startIndex, startIndex + itemsPerPage);
  }, [claims, currentPage, itemsPerPage]);

  const handleFilterChange = (key: string, value: string | boolean) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilter = (key: string) => {
    const defaults: Record<string, string | boolean> = {
      startDate: firstDay,
      endDate: lastDay,
      brandId: "all",
      customerId: "all",
      productId: "all",
      hideZeroClaims: false,
      usePrice: "sellingPrice",
    };
    handleFilterChange(key, defaults[key]);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(amount);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });

  const handleExportExcel = async () => {
    const { company } = await fetchCompanySettings();
    if (viewMode === "brand") {
      const headers = ["Brand", "Products", "Invoices", "Total Qty", "Total Claim"];
      const rows = brandWiseClaims.map((b) => [b.brand, b.productCount, b.invoiceCount, b.totalQuantity, b.totalClaim]);
      exportToExcel({ fileName: `Claim-Report-Brand-Wise_${fmtDateExport(filters.startDate)}_to_${fmtDateExport(filters.endDate)}.xlsx`, sheets: [{ name: "Brand-Wise Claims", headers, rows }], company });
    } else {
      const headers = ["Date", "Invoice No", "Brand", "Sub-Brand", "Customer", "Product Name", "MRP", "Selling Price", "Sold Rate", "Qty", "Unit Claim", "Total Claim"];
      const rows = claims.map((c) => [fmtDateExport(c.date), c.invoiceNumber, c.brand, c.subBrand, c.customer, c.productName, c.mrp, c.sellingPrice, c.soldRate, c.quantity, c.unitClaim, c.totalClaim]);
      exportToExcel({ fileName: `Claim-Report_${fmtDateExport(filters.startDate)}_to_${fmtDateExport(filters.endDate)}.xlsx`, sheets: [{ name: "Claim Report", headers, rows }], company });
    }
  };

  const handleExportPDF = async () => {
    const { company } = await fetchCompanySettings();
    if (viewMode === "brand") {
      const headers = ["Brand", "Products", "Invoices", "Total Qty", "Total Claim"];
      const rows = brandWiseClaims.map((b) => [b.brand, b.productCount, b.invoiceCount, b.totalQuantity, fmtNum(b.totalClaim)]);
      exportToPDF({ fileName: `Claim-Report-Brand-Wise_${fmtDateExport(filters.startDate)}_to_${fmtDateExport(filters.endDate)}.pdf`, title: "Claim Report (Brand-wise)", subtitle: `${fmtDateExport(filters.startDate)} to ${fmtDateExport(filters.endDate)}`, orientation: "portrait", sheets: [{ name: "Brand Claims", headers, rows }], company });
    } else {
      const headers = ["Date", "Invoice", "Brand", "Sub-Brand", "Customer", "Product", "MRP", "Sell Price", "Sold Rate", "Qty", "Unit Claim", "Total Claim"];
      const rows = claims.map((c) => [fmtDateExport(c.date), c.invoiceNumber, c.brand, c.subBrand, c.customer, c.productName, fmtNum(c.mrp), fmtNum(c.sellingPrice), fmtNum(c.soldRate), c.quantity, fmtNum(c.unitClaim), fmtNum(c.totalClaim)]);
      exportToPDF({ fileName: `Claim-Report_${fmtDateExport(filters.startDate)}_to_${fmtDateExport(filters.endDate)}.pdf`, title: "Claim Report", subtitle: `${fmtDateExport(filters.startDate)} to ${fmtDateExport(filters.endDate)}`, orientation: "landscape", sheets: [{ name: "Claims", headers, rows }], company });
    }
  };

  // ── Email send handler ─────────────────────────────────────
  const handleEmailSend = async (emails: string[], fromDate: string, toDate: string) => {
    const { company } = await fetchCompanySettings();

    const qs = new URLSearchParams({ startDate: fromDate, endDate: toDate });
    if (filters.brandId !== "all") qs.append("brandId", filters.brandId);
    if (filters.customerId !== "all") qs.append("customerId", filters.customerId);
    if (filters.productId !== "all") qs.append("productId", filters.productId);
    if (filters.hideZeroClaims) qs.append("hideZeroClaims", "true");
    qs.append("usePrice", filters.usePrice);

    const res = await fetch(`/api/reports/claim-report?${qs}`);
    if (!res.ok) throw new Error("Failed to fetch report data");
    const fetchedData = await res.json();
    const fetchedClaims: ClaimRecord[] = fetchedData.claims || [];

    const headers = ["Date", "Invoice", "Brand", "Sub-Brand", "Customer", "Product", "MRP", "Sell Price", "Sold Rate", "Qty", "Unit Claim", "Total Claim"];
    const rows = fetchedClaims.map((c) => [fmtDateExport(c.date), c.invoiceNumber, c.brand, c.subBrand, c.customer, c.productName, fmtNum(c.mrp), fmtNum(c.sellingPrice), fmtNum(c.soldRate), c.quantity, fmtNum(c.unitClaim), fmtNum(c.totalClaim)]);

    const pdfBase64 = generatePDFBase64({
      title: "Claim Report",
      subtitle: `${fmtDateExport(fromDate)} to ${fmtDateExport(toDate)}`,
      orientation: "landscape",
      sheets: [{ name: "Claims", headers, rows }],
      company,
    });

    const send = await fetch("/api/reports/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emails,
        subject: `Claim Report — ${fmtDateExport(fromDate)} to ${fmtDateExport(toDate)}`,
        pdfBase64,
        filename: `Claim-Report_${fmtDateExport(fromDate)}_to_${fmtDateExport(toDate)}.pdf`,
        reportTitle: "Claim Report",
        dateRange: `${fmtDateExport(fromDate)} to ${fmtDateExport(toDate)}`,
      }),
    });
    if (!send.ok) {
      const d = await send.json();
      throw new Error(d.error || "Failed to send email");
    }
  };

  const totalClaimAmount = claims.reduce((sum, c) => sum + c.totalClaim, 0);

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-teal-600" />
              <h1 className="text-2xl font-bold text-gray-900">Claim Report</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* View mode toggle */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("item")}
                  className={`rounded-none gap-1.5 ${viewMode === "item" ? "bg-teal-500 text-white hover:bg-teal-600" : "hover:bg-gray-50"}`}
                >
                  <LayoutList className="h-4 w-4" />
                  Item-wise
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("brand")}
                  className={`rounded-none gap-1.5 border-l ${viewMode === "brand" ? "bg-teal-500 text-white hover:bg-teal-600" : "hover:bg-gray-50"}`}
                >
                  <BarChart3 className="h-4 w-4" />
                  Brand-wise
                </Button>
              </div>
              <ExportButtons onExportPDF={handleExportPDF} onExportExcel={handleExportExcel} disabled={isLoading || claims.length === 0} />
              <EmailReportDialog
                reportTitle="Claim Report"
                defaultStartDate={filters.startDate}
                defaultEndDate={filters.endDate}
                hasDateFilter
                onSendEmail={handleEmailSend}
                disabled={isLoading || claims.length === 0}
              />
            </div>
          </div>
          <p className="text-gray-600">
            Track product claims based on selling price vs sold rate differences
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Start Date */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="startDate">Start Date</Label>
                {filters.startDate !== firstDay && (
                  <button onClick={() => clearFilter("startDate")} className="text-gray-400 hover:text-gray-600" title="Clear">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange("startDate", e.target.value)}
              />
            </div>

            {/* End Date */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="endDate">End Date</Label>
                {filters.endDate !== lastDay && (
                  <button onClick={() => clearFilter("endDate")} className="text-gray-400 hover:text-gray-600" title="Clear">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
              />
            </div>

            {/* Brand Filter */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="brand">Brand</Label>
                {filters.brandId !== "all" && (
                  <button onClick={() => clearFilter("brandId")} className="text-gray-400 hover:text-gray-600" title="Clear">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Select value={filters.brandId} onValueChange={(value) => handleFilterChange("brandId", value)}>
                <SelectTrigger id="brand">
                  <SelectValue placeholder="All Brands" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  {brandsData?.brands?.map((brand: { id: string; name: string }) => (
                    <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Customer Filter */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="customer">Customer</Label>
                {filters.customerId !== "all" && (
                  <button onClick={() => clearFilter("customerId")} className="text-gray-400 hover:text-gray-600" title="Clear">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Select value={filters.customerId} onValueChange={(value) => handleFilterChange("customerId", value)}>
                <SelectTrigger id="customer">
                  <SelectValue placeholder="All Customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customersData?.customers?.map((customer: { id: string; name: string }) => (
                    <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Product Filter */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="product">Product</Label>
                {filters.productId !== "all" && (
                  <button onClick={() => clearFilter("productId")} className="text-gray-400 hover:text-gray-600" title="Clear">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Select value={filters.productId} onValueChange={(value) => handleFilterChange("productId", value)}>
                <SelectTrigger id="product">
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {itemsData?.items?.map((item: { id: string; name: string }) => (
                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Price Type */}
            <div>
              <Label htmlFor="usePrice" className="block mb-1">Calculate Claims Using</Label>
              <Select value={filters.usePrice} onValueChange={(value) => handleFilterChange("usePrice", value)}>
                <SelectTrigger id="usePrice">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sellingPrice">Selling Price</SelectItem>
                  <SelectItem value="mrp">MRP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Hide Zero Claims */}
            <div className="flex items-center space-x-2 mt-6">
              <Checkbox
                id="hideZeroClaims"
                checked={filters.hideZeroClaims}
                onCheckedChange={(checked) => handleFilterChange("hideZeroClaims", checked)}
              />
              <Label htmlFor="hideZeroClaims" className="text-sm font-medium leading-none">
                Hide items with zero claim
              </Label>
            </div>
          </div>
        </div>

        {/* Brand-wise view */}
        {viewMode === "brand" ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="text-center py-12 text-gray-500 flex items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Loading claim report...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12 text-red-600">Error loading claim report</div>
            ) : brandWiseClaims.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No claim data found for the selected filters</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold">Brand</TableHead>
                      <TableHead className="font-semibold text-right">Products</TableHead>
                      <TableHead className="font-semibold text-right">Invoices</TableHead>
                      <TableHead className="font-semibold text-right">Total Qty</TableHead>
                      <TableHead className="font-semibold text-right">Total Claim</TableHead>
                      <TableHead className="font-semibold text-right">% of Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {brandWiseClaims.map((b, index) => (
                      <TableRow key={b.brandId || index} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{b.brand}</TableCell>
                        <TableCell className="text-right text-gray-700">{b.productCount}</TableCell>
                        <TableCell className="text-right text-gray-700">{b.invoiceCount}</TableCell>
                        <TableCell className="text-right text-gray-700">{b.totalQuantity.toFixed(2)}</TableCell>
                        <TableCell className={`text-right font-semibold ${b.totalClaim > 0 ? "text-red-600" : b.totalClaim < 0 ? "text-green-600" : "text-gray-600"}`}>
                          {formatCurrency(b.totalClaim)}
                        </TableCell>
                        <TableCell className="text-right text-gray-500">
                          {totalClaimAmount !== 0 ? `${Math.abs((b.totalClaim / totalClaimAmount) * 100).toFixed(1)}%` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Grand total row */}
                    <TableRow className="bg-gray-50 font-semibold border-t-2">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{brandWiseClaims.reduce((s, b) => s + b.productCount, 0)}</TableCell>
                      <TableCell className="text-right">{new Set(claims.map((c) => c.invoiceId)).size}</TableCell>
                      <TableCell className="text-right">{brandWiseClaims.reduce((s, b) => s + b.totalQuantity, 0).toFixed(2)}</TableCell>
                      <TableCell className={`text-right ${totalClaimAmount > 0 ? "text-red-600" : totalClaimAmount < 0 ? "text-green-600" : "text-gray-600"}`}>
                        {formatCurrency(totalClaimAmount)}
                      </TableCell>
                      <TableCell className="text-right">100%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        ) : (
          /* Item-wise view */
          <>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="text-center py-12 text-gray-500 flex items-center justify-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Loading claim report...</span>
                </div>
              ) : error ? (
                <div className="text-center py-12 text-red-600">
                  <p>Error loading claim report</p>
                  <p className="text-sm text-gray-500 mt-2">{error.message || "Please try again"}</p>
                </div>
              ) : claims.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No claim data found for the selected filters
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Invoice No</TableHead>
                        <TableHead className="font-semibold">Brand</TableHead>
                        <TableHead className="font-semibold">Sub-Brand</TableHead>
                        <TableHead className="font-semibold">Customer</TableHead>
                        <TableHead className="font-semibold">Product Name</TableHead>
                        <TableHead className={`font-semibold text-right ${filters.usePrice === "mrp" ? "bg-teal-50" : ""}`}>
                          MRP {filters.usePrice === "mrp" && "✓"}
                        </TableHead>
                        <TableHead className={`font-semibold text-right ${filters.usePrice === "sellingPrice" ? "bg-teal-50" : ""}`}>
                          Selling Price {filters.usePrice === "sellingPrice" && "✓"}
                        </TableHead>
                        <TableHead className="font-semibold text-right">Sold Rate</TableHead>
                        <TableHead className="font-semibold text-right">Qty</TableHead>
                        <TableHead className="font-semibold text-right">Unit Claim</TableHead>
                        <TableHead className="font-semibold text-right">Total Claim</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedClaims.map((claim, index) => (
                        <TableRow key={`${claim.invoiceId}-${claim.productId}-${index}`}>
                          <TableCell>{formatDate(claim.date)}</TableCell>
                          <TableCell className="font-mono">{claim.invoiceNumber}</TableCell>
                          <TableCell>{claim.brand}</TableCell>
                          <TableCell>{claim.subBrand}</TableCell>
                          <TableCell>{claim.customer}</TableCell>
                          <TableCell className="font-medium">{claim.productName}</TableCell>
                          <TableCell className={`text-right ${filters.usePrice === "mrp" ? "bg-teal-50 font-medium" : ""}`}>
                            {formatCurrency(claim.mrp)}
                          </TableCell>
                          <TableCell className={`text-right ${filters.usePrice === "sellingPrice" ? "bg-teal-50 font-medium" : ""}`}>
                            {formatCurrency(claim.sellingPrice)}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(claim.soldRate)}</TableCell>
                          <TableCell className="text-right">{claim.quantity}</TableCell>
                          <TableCell className={`text-right font-medium ${claim.unitClaim > 0 ? "text-red-600" : claim.unitClaim < 0 ? "text-green-600" : "text-gray-600"}`}>
                            {formatCurrency(claim.unitClaim)}
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${claim.totalClaim > 0 ? "text-red-600" : claim.totalClaim < 0 ? "text-green-600" : "text-gray-600"}`}>
                            {formatCurrency(claim.totalClaim)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {!isLoading && claims.length > 0 && totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(currentPage * itemsPerPage, claims.length)} of {claims.length} records
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                  <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Summary Footer */}
        {!isLoading && claims.length > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            <span>Total Records: <span className="font-semibold text-gray-900">{claims.length}</span></span>
            <span className="mx-4">|</span>
            <span>Total Claim Amount: <span className="font-semibold text-gray-900">{formatCurrency(totalClaimAmount)}</span></span>
            {viewMode === "brand" && (
              <>
                <span className="mx-4">|</span>
                <span>Brands: <span className="font-semibold text-gray-900">{brandWiseClaims.length}</span></span>
              </>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
