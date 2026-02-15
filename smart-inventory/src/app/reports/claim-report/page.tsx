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
import { Loader2, FileText } from "lucide-react";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { exportToExcel, exportToPDF, fmtNum, fmtDateExport } from "@/lib/export-utils";
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

export default function ClaimReportPage() {
  // Get current month as default date range
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
    usePrice: "sellingPrice", // 'sellingPrice' or 'mrp'
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Fetch customers, brands, and items for filters
  const { data: customersData } = useSWR("/api/customers?limit=1000");
  const { data: brandsData } = useSWR("/api/brands");
  const { data: itemsData } = useSWR("/api/items?limit=1000");

  // Build query string for API
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

  // Fetch claim report data
  const { data, error, isLoading } = useSWR(
    `/api/reports/claim-report?${queryString}`
  );

  const claims: ClaimRecord[] = useMemo(() => data?.claims || [], [data]);

  // Paginate claims
  const totalPages = Math.ceil(claims.length / itemsPerPage);
  const paginatedClaims = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return claims.slice(startIndex, endIndex);
  }, [claims, currentPage, itemsPerPage]);

  // Handle filter changes
  const handleFilterChange = (key: string, value: string | boolean) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const handleExportExcel = () => {
    const headers = ["Date", "Invoice No", "Brand", "Sub-Brand", "Customer", "Product Name", "MRP", "Selling Price", "Sold Rate", "Qty", "Unit Claim", "Total Claim"];
    const rows = claims.map((c) => [fmtDateExport(c.date), c.invoiceNumber, c.brand, c.subBrand, c.customer, c.productName, c.mrp, c.sellingPrice, c.soldRate, c.quantity, c.unitClaim, c.totalClaim]);
    exportToExcel({ fileName: `Claim-Report_${fmtDateExport(filters.startDate)}_to_${fmtDateExport(filters.endDate)}.xlsx`, sheets: [{ name: "Claim Report", headers, rows }] });
  };

  const handleExportPDF = () => {
    const headers = ["Date", "Invoice", "Brand", "Sub-Brand", "Customer", "Product", "MRP", "Sell Price", "Sold Rate", "Qty", "Unit Claim", "Total Claim"];
    const rows = claims.map((c) => [fmtDateExport(c.date), c.invoiceNumber, c.brand, c.subBrand, c.customer, c.productName, fmtNum(c.mrp), fmtNum(c.sellingPrice), fmtNum(c.soldRate), c.quantity, fmtNum(c.unitClaim), fmtNum(c.totalClaim)]);
    exportToPDF({ fileName: `Claim-Report_${fmtDateExport(filters.startDate)}_to_${fmtDateExport(filters.endDate)}.pdf`, title: "Claim Report", subtitle: `${fmtDateExport(filters.startDate)} to ${fmtDateExport(filters.endDate)}`, orientation: "landscape", sheets: [{ name: "Claims", headers, rows }] });
  };

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
            <ExportButtons onExportPDF={handleExportPDF} onExportExcel={handleExportExcel} disabled={isLoading || claims.length === 0} />
          </div>
          <p className="text-gray-600">
            Track product claims based on selling price vs sold rate differences
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Date Range */}
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  handleFilterChange("startDate", e.target.value)
                }
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
              />
            </div>

            {/* Brand Filter */}
            <div>
              <Label htmlFor="brand">Brand</Label>
              <Select
                value={filters.brandId}
                onValueChange={(value) => handleFilterChange("brandId", value)}
              >
                <SelectTrigger id="brand">
                  <SelectValue placeholder="All Brands" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  {brandsData?.brands?.map((brand: { id: string; name: string }) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Customer Filter */}
            <div>
              <Label htmlFor="customer">Customer</Label>
              <Select
                value={filters.customerId}
                onValueChange={(value) =>
                  handleFilterChange("customerId", value)
                }
              >
                <SelectTrigger id="customer">
                  <SelectValue placeholder="All Customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customersData?.customers?.map((customer: { id: string; name: string }) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Product Filter */}
            <div>
              <Label htmlFor="product">Product</Label>
              <Select
                value={filters.productId}
                onValueChange={(value) =>
                  handleFilterChange("productId", value)
                }
              >
                <SelectTrigger id="product">
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {itemsData?.items?.map((item: { id: string; name: string }) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Price Type Selection */}
            <div>
              <Label htmlFor="usePrice">Calculate Claims Using</Label>
              <Select
                value={filters.usePrice}
                onValueChange={(value) => handleFilterChange("usePrice", value)}
              >
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
                onCheckedChange={(checked) =>
                  handleFilterChange("hideZeroClaims", checked)
                }
              />
              <Label
                htmlFor="hideZeroClaims"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Hide items with zero claim
              </Label>
            </div>
          </div>
        </div>

        {/* Report Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Loading claim report...</span>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600">
              <p>Error loading claim report</p>
              <p className="text-sm text-gray-500 mt-2">
                {error.message || "Please try again"}
              </p>
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
                    <TableHead className={`font-semibold text-right ${filters.usePrice === 'mrp' ? 'bg-teal-50' : ''}`}>
                      MRP {filters.usePrice === 'mrp' && '✓'}
                    </TableHead>
                    <TableHead className={`font-semibold text-right ${filters.usePrice === 'sellingPrice' ? 'bg-teal-50' : ''}`}>
                      Selling Price {filters.usePrice === 'sellingPrice' && '✓'}
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      Sold Rate
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      Qty
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      Unit Claim
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      Total Claim
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedClaims.map((claim, index) => (
                    <TableRow key={`${claim.invoiceId}-${claim.productId}-${index}`}>
                      <TableCell>{formatDate(claim.date)}</TableCell>
                      <TableCell className="font-mono">
                        {claim.invoiceNumber}
                      </TableCell>
                      <TableCell>{claim.brand}</TableCell>
                      <TableCell>{claim.subBrand}</TableCell>
                      <TableCell>{claim.customer}</TableCell>
                      <TableCell className="font-medium">
                        {claim.productName}
                      </TableCell>
                      <TableCell className={`text-right ${filters.usePrice === 'mrp' ? 'bg-teal-50 font-medium' : ''}`}>
                        {formatCurrency(claim.mrp)}
                      </TableCell>
                      <TableCell className={`text-right ${filters.usePrice === 'sellingPrice' ? 'bg-teal-50 font-medium' : ''}`}>
                        {formatCurrency(claim.sellingPrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(claim.soldRate)}
                      </TableCell>
                      <TableCell className="text-right">
                        {claim.quantity}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          claim.unitClaim > 0
                            ? "text-red-600"
                            : claim.unitClaim < 0
                            ? "text-green-600"
                            : "text-gray-600"
                        }`}
                      >
                        {formatCurrency(claim.unitClaim)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          claim.totalClaim > 0
                            ? "text-red-600"
                            : claim.totalClaim < 0
                            ? "text-green-600"
                            : "text-gray-600"
                        }`}
                      >
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
              {Math.min(currentPage * itemsPerPage, claims.length)} of{" "}
              {claims.length} records
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Summary Footer */}
        {!isLoading && claims.length > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            <span>Total Records: <span className="font-semibold text-gray-900">{claims.length}</span></span>
            <span className="mx-4">|</span>
            <span>Total Claim Amount: <span className="font-semibold text-gray-900">
              {formatCurrency(
                claims.reduce((sum, claim) => sum + claim.totalClaim, 0)
              )}
            </span></span>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
