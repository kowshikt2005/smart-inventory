"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
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
import { Loader2, Package } from "lucide-react";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { exportToExcel, exportToPDF, fmtNum, fetchCompanySettings } from "@/lib/export-utils";
import { useState, useMemo } from "react";
import useSWR from "swr";

interface StockItem {
  id: string;
  itemCode: string;
  userCode: string | null;
  name: string;
  brand: string;
  brandId: string;
  subBrand: string;
  subBrandId: string;
  hsnCode: string;
  unit: string;
  purchasePrice: number;
  physicalStock: number;
  reservedQuantity: number;
  availableStock: number;
  stockValue: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(n);

const fmtQty = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(n);

export default function ClosingStockPage() {
  const [filters, setFilters] = useState({
    brandId: "all",
    hideZeroStock: false,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Fetch brands for filter
  const { data: brandsData } = useSWR("/api/brands");

  // Build query string
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.brandId && filters.brandId !== "all")
      params.append("brandId", filters.brandId);
    if (filters.hideZeroStock) params.append("hideZeroStock", "true");
    return params.toString();
  }, [filters]);

  // Fetch closing stock data
  const { data, error, isLoading } = useSWR(
    `/api/reports/closing-stock?${queryString}`
  );

  const items: StockItem[] = useMemo(() => data?.items || [], [data]);
  const summary = data?.summary || {
    totalItems: 0,
    totalQuantity: 0,
    totalValue: 0,
  };

  // Paginate
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  }, [items, currentPage, itemsPerPage]);

  const handleFilterChange = (key: string, value: string | boolean) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleExportExcel = async () => {
    const { company } = await fetchCompanySettings();
    const headers = ["Item Code", "Name", "Brand", "Sub-Brand", "HSN", "Unit", "Purchase Price", "Avail. Stock", "Stock Value"];
    const rows = items.map((i) => [i.itemCode, i.name, i.brand, i.subBrand, i.hsnCode, i.unit, i.purchasePrice, i.availableStock, i.stockValue]);
    rows.push(["", "", "", "", "", "", "Total", summary.totalQuantity, summary.totalValue]);
    exportToExcel({ fileName: `Closing-Stock.xlsx`, sheets: [{ name: "Closing Stock", headers, rows }], company });
  };

  const handleExportPDF = async () => {
    const { company } = await fetchCompanySettings();
    const headers = ["Code", "Name", "Brand", "Sub-Brand", "HSN", "Unit", "Price", "Stock", "Value"];
    const rows = items.map((i) => [i.itemCode, i.name, i.brand, i.subBrand, i.hsnCode, i.unit, fmtNum(i.purchasePrice), i.availableStock, fmtNum(i.stockValue)]);
    rows.push(["", "", "", "", "", "", "Total", summary.totalQuantity, fmtNum(summary.totalValue)]);
    exportToPDF({ fileName: `Closing-Stock.pdf`, title: "Closing Stock Report", subtitle: `As of ${new Date().toLocaleDateString("en-IN")}`, orientation: "landscape", sheets: [{ name: "Closing Stock", headers, rows }], company });
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Package className="h-6 w-6 text-teal-600" />
              <h1 className="text-2xl font-bold text-gray-900">Closing Stock</h1>
            </div>
            <ExportButtons onExportPDF={handleExportPDF} onExportExcel={handleExportExcel} disabled={isLoading || items.length === 0} />
          </div>
          <p className="text-gray-600">
            Current inventory levels with stock valuation at cost price
          </p>
        </div>

        {/* Summary Cards */}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-sm text-gray-500">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">
                {summary.totalItems}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-sm text-gray-500">Total Quantity</p>
              <p className="text-2xl font-bold text-gray-900">
                {fmtQty(summary.totalQuantity)}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-sm text-gray-500">Total Stock Value</p>
              <p className="text-2xl font-bold text-gray-900">
                {fmt(summary.totalValue)}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  {brandsData?.brands?.map(
                    (brand: { id: string; name: string }) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Hide Zero Stock */}
            <div className="flex items-center space-x-2 mt-6">
              <Checkbox
                id="hideZeroStock"
                checked={filters.hideZeroStock}
                onCheckedChange={(checked) =>
                  handleFilterChange("hideZeroStock", checked)
                }
              />
              <Label
                htmlFor="hideZeroStock"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Hide zero stock items
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
                <span>Loading closing stock report...</span>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600">
              <p>Error loading closing stock report</p>
              <p className="text-sm text-gray-500 mt-2">
                {error.message || "Please try again"}
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No stock data found for the selected filters
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Item Code</TableHead>
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Brand</TableHead>
                    <TableHead className="font-semibold">Sub-Brand</TableHead>
                    <TableHead className="font-semibold">HSN</TableHead>
                    <TableHead className="font-semibold">Unit</TableHead>
                    <TableHead className="font-semibold text-right">
                      Purchase Price
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      Avail. Stock
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      Stock Value
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">
                        {item.itemCode}
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.brand}</TableCell>
                      <TableCell>{item.subBrand}</TableCell>
                      <TableCell>{item.hsnCode}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-right">
                        {fmt(item.purchasePrice)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          item.availableStock <= 0
                            ? "text-red-600"
                            : "text-gray-900"
                        }`}
                      >
                        {fmtQty(item.availableStock)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {fmt(item.stockValue)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total Row */}
                  <TableRow className="bg-gray-50 border-t-2 border-gray-300">
                    <TableCell
                      colSpan={7}
                      className="font-bold text-gray-900 text-right"
                    >
                      Total
                    </TableCell>
                    <TableCell className="text-right font-bold text-gray-900">
                      {fmtQty(summary.totalQuantity)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-gray-900">
                      {fmt(summary.totalValue)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!isLoading && items.length > 0 && totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, items.length)} of{" "}
              {items.length} items
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
      </div>
    </DashboardLayout>
  );
}
