"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, Search, Package } from "lucide-react";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { exportToExcel, exportToPDF, fmtDateExport } from "@/lib/export-utils";
import { useState, useCallback } from "react";
import useSWR from "swr";

interface Item {
  id: string;
  itemCode: string;
  name: string;
  unit: string;
}

interface StockMovement {
  id: string;
  date: string;
  type: string;
  particulars: string;
  referenceType: string | null;
  referenceId: string | null;
  inQty: number;
  outQty: number;
  runningBalance: number;
}

interface LedgerSummary {
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  closingBalance: number;
}

interface ItemInfo {
  id: string;
  itemCode: string;
  name: string;
  unit: string;
  currentStock: number;
  reservedQuantity: number;
}

const TYPE_LABELS: Record<string, string> = {
  PURCHASE: "Purchase",
  SALE: "Sale",
  ADJUSTMENT_IN: "Adjustment In",
  ADJUSTMENT_OUT: "Adjustment Out",
  RETURN: "Return",
  DAMAGE: "Damage",
  TRANSFER: "Transfer",
};

export default function StockLedgerPage() {
  const [selectedItemId, setSelectedItemId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [itemInfo, setItemInfo] = useState<ItemInfo | null>(null);

  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch items
  const { data: itemsData, isLoading: isLoadingItems } = useSWR("/api/items?limit=1000");
  const items: Item[] = itemsData?.items || [];

  // Fetch ledger
  const fetchLedger = useCallback(async () => {
    if (!selectedItemId) {
      setMovements([]);
      setSummary(null);
      setItemInfo(null);
      return;
    }

    try {
      setIsLoadingLedger(true);
      setError(null);

      let url = `/api/ledger/items/${selectedItemId}`;
      const params = new URLSearchParams();
      if (fromDate) params.append("fromDate", fromDate);
      if (toDate) params.append("toDate", toDate);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch ledger");

      const data = await response.json();
      setMovements(data.movements || []);
      setSummary(data.summary || null);
      setItemInfo(data.item || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch ledger");
    } finally {
      setIsLoadingLedger(false);
    }
  }, [selectedItemId, fromDate, toDate]);

  // Format date only
  const formatDateOnly = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Format time from createdAt (actual entry timestamp)
  const formatTimeOnly = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    // Check if it's a valid date
    if (isNaN(date.getTime())) return '-';
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = (hours % 12 || 12).toString().padStart(2, '0');
    return `${displayHours}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatQty = (qty: number, unit: string = "") => {
    if (qty === 0) return "-";
    return `${qty.toFixed(3)} ${unit}`.trim();
  };

  const handleExportExcel = () => {
    if (!movements.length || !summary || !itemInfo) return;
    const unit = itemInfo.unit || "";
    const headers = ["Date", "Particulars", "Type", "In Qty", "Out Qty", "Balance"];
    const rows: (string | number)[][] = [];
    rows.push([fromDate ? fmtDateExport(fromDate) : "Opening", "Opening Balance", "-", "-", "-", `${summary.openingBalance.toFixed(3)} ${unit}`]);
    movements.forEach((m) => rows.push([fmtDateExport(m.date), m.particulars, m.type, m.inQty > 0 ? m.inQty : "-", m.outQty > 0 ? m.outQty : "-", `${m.runningBalance.toFixed(3)} ${unit}`]));
    rows.push(["Closing", "Closing Balance", "-", summary.totalIn, summary.totalOut, `${summary.closingBalance.toFixed(3)} ${unit}`]);
    exportToExcel({ fileName: `Stock-Ledger_${itemInfo.name}.xlsx`, sheets: [{ name: "Stock Ledger", headers, rows }] });
  };

  const handleExportPDF = () => {
    if (!movements.length || !summary || !itemInfo) return;
    const unit = itemInfo.unit || "";
    const headers = ["Date", "Particulars", "Type", "In Qty", "Out Qty", "Balance"];
    const rows: (string | number)[][] = [];
    rows.push([fromDate ? fmtDateExport(fromDate) : "Opening", "Opening Balance", "-", "-", "-", `${summary.openingBalance.toFixed(3)} ${unit}`]);
    movements.forEach((m) => rows.push([fmtDateExport(m.date), m.particulars, m.type, m.inQty > 0 ? `${m.inQty.toFixed(3)} ${unit}` : "-", m.outQty > 0 ? `${m.outQty.toFixed(3)} ${unit}` : "-", `${m.runningBalance.toFixed(3)} ${unit}`]));
    rows.push(["Closing", "Closing Balance", "-", `${summary.totalIn.toFixed(3)} ${unit}`, `${summary.totalOut.toFixed(3)} ${unit}`, `${summary.closingBalance.toFixed(3)} ${unit}`]);
    const dateRange = fromDate && toDate ? `${fmtDateExport(fromDate)} to ${fmtDateExport(toDate)}` : "All dates";
    exportToPDF({ fileName: `Stock-Ledger_${itemInfo.name}.pdf`, title: `Stock Ledger — ${itemInfo.name} (${itemInfo.itemCode})`, subtitle: dateRange, sheets: [{ name: "Stock Ledger", headers, rows }] });
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Stock Ledger</h1>
            <p className="text-gray-600">View item-wise stock movement history</p>
          </div>
          <ExportButtons onExportPDF={handleExportPDF} onExportExcel={handleExportExcel} disabled={movements.length === 0} />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Item Selection */}
            <div>
              <Label htmlFor="item">Item</Label>
              <Select
                value={selectedItemId}
                onValueChange={setSelectedItemId}
                disabled={isLoadingItems}
              >
                <SelectTrigger id="item">
                  <SelectValue placeholder="Select item..." />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.itemCode} - {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* From Date */}
            <div>
              <Label htmlFor="fromDate">From Date</Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            {/* To Date */}
            <div>
              <Label htmlFor="toDate">To Date</Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            {/* Search Button */}
            <div className="flex items-end">
              <Button
                onClick={fetchLedger}
                disabled={!selectedItemId || isLoadingLedger}
                className="bg-teal-500 hover:bg-teal-600"
              >
                {isLoadingLedger ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                View Ledger
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        {summary && itemInfo && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Opening Qty</p>
              <p className="text-xl font-bold text-gray-900">
                {formatQty(summary.openingBalance, itemInfo.unit)}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Total In</p>
              <p className="text-xl font-bold text-green-600">
                {formatQty(summary.totalIn, itemInfo.unit)}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Total Out</p>
              <p className="text-xl font-bold text-red-600">
                {formatQty(summary.totalOut, itemInfo.unit)}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Closing Qty</p>
              <p className="text-xl font-bold text-gray-900">
                {formatQty(summary.closingBalance, itemInfo.unit)}
              </p>
            </div>
          </div>
        )}

        {/* Ledger Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {!selectedItemId ? (
            <div className="text-center py-16 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>Select an item to view its stock ledger</p>
            </div>
          ) : isLoadingLedger ? (
            <div className="text-center py-16 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Loading ledger...</p>
            </div>
          ) : movements.length === 0 && !summary ? (
            <div className="text-center py-16 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>Click &quot;View Ledger&quot; to load stock movements</p>
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No stock movements found for this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Time</TableHead>
                    <TableHead className="font-semibold">Particulars</TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="font-semibold text-right">In Qty</TableHead>
                    <TableHead className="font-semibold text-right">Out Qty</TableHead>
                    <TableHead className="font-semibold text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Opening Balance Row */}
                  {summary && (
                    <TableRow className="bg-gray-50">
                      <TableCell className="font-medium">
                        {fromDate ? formatDate(fromDate) : "Opening"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">-</TableCell>
                      <TableCell className="font-medium">Opening Balance</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatQty(summary.openingBalance, itemInfo?.unit)}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Movement Rows */}
                  {movements.map((movement) => (
                    <TableRow key={movement.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm whitespace-nowrap">{formatDateOnly(movement.date)}</TableCell>
                      <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                        {formatTimeOnly(movement.date)}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate" title={movement.particulars}>
                          {movement.particulars}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {TYPE_LABELS[movement.type] || movement.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {movement.inQty > 0 ? formatQty(movement.inQty, itemInfo?.unit) : "-"}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {movement.outQty > 0 ? formatQty(movement.outQty, itemInfo?.unit) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatQty(movement.runningBalance, itemInfo?.unit)}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Closing Balance Row */}
                  {summary && (
                    <TableRow className="bg-gray-100 font-semibold">
                      <TableCell>{toDate ? formatDate(toDate) : "Closing"}</TableCell>
                      <TableCell className="text-gray-500">-</TableCell>
                      <TableCell>Closing Balance</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatQty(summary.totalIn, itemInfo?.unit)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatQty(summary.totalOut, itemInfo?.unit)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatQty(summary.closingBalance, itemInfo?.unit)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
