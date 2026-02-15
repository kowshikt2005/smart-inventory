"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { exportToExcel, exportToPDF, fmtNum } from "@/lib/export-utils";

// ── Indian fiscal year helpers ──────────────────────────────────
function getCurrentFiscalYear(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

function fiscalDates(year: number) {
  return {
    startDate: `${year}-04-01`,
    endDate: `${year + 1}-03-31`,
  };
}

type Period = "this_fy" | "last_fy" | "custom";

interface MonthData {
  month: string;
  monthIndex: number;
  year: number;
  grossAmount: number;
  taxAmount: number;
  netAmount: number;
}

// ── Page ────────────────────────────────────────────────────────
export default function SalesRegisterPage() {
  const currentFY = getCurrentFiscalYear();
  const router = useRouter();

  const [period, setPeriod] = useState<Period>("this_fy");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [customerId, setCustomerId] = useState("all");
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);

  // ── Effective date range ────────────────────────────────────
  const { startDate, endDate } = useMemo(() => {
    if (period === "this_fy") return fiscalDates(currentFY);
    if (period === "last_fy") return fiscalDates(currentFY - 1);
    return { startDate: customStart, endDate: customEnd };
  }, [period, currentFY, customStart, customEnd]);

  // ── Customer list for filter ────────────────────────────────
  const { data: customersData } = useSWR("/api/customers?limit=500");
  const customers: { id: string; name: string }[] =
    customersData?.customers || [];

  const selectedCustomerName =
    customerId === "all"
      ? "All Customers"
      : customers.find((c) => c.id === customerId)?.name || "All Customers";

  // ── API query ───────────────────────────────────────────────
  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (startDate) p.append("startDate", startDate);
    if (endDate) p.append("endDate", endDate);
    if (customerId !== "all") p.append("customerId", customerId);
    return p.toString();
  }, [startDate, endDate, customerId]);

  const { data, isLoading } = useSWR(
    startDate && endDate ? `/api/reports/sales-register?${queryString}` : null
  );

  // Process months data to include year and month index
  const months: MonthData[] = useMemo(() => {
    if (!data?.months || !startDate) return [];

    const start = new Date(startDate);
    let y = start.getFullYear();
    let m = start.getMonth();

    return (data.months as { month: string; grossAmount: number; taxAmount: number; netAmount: number }[]).map((row) => {
      const result = {
        ...row,
        monthIndex: m,
        year: y,
      };
      m++;
      if (m > 11) { m = 0; y++; }
      return result;
    });
  }, [data?.months, startDate]);

  const totals = data?.totals || { grossAmount: 0, taxAmount: 0, netAmount: 0 };

  // ── Helpers ─────────────────────────────────────────────────
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const fmtDate = (s: string) => {
    if (!s) return "";
    const [y, m, d] = s.split("-");
    return `${d}-${m}-${y}`;
  };

  const now = new Date();
  const currentMonthName = now.toLocaleString("en-US", { month: "long" });

  // ── Export handlers ────────────────────────────────────────
  const handleExportExcel = () => {
    const rows = months.map((r) => [r.month + " " + r.year, r.grossAmount, r.taxAmount, r.netAmount]);
    rows.push(["Total", totals.grossAmount, totals.taxAmount, totals.netAmount]);
    exportToExcel({
      fileName: `Sales-Register_${fmtDate(startDate)}_to_${fmtDate(endDate)}.xlsx`,
      sheets: [{ name: "Sales Register", headers: ["Month", "Gross Amount", "Tax Amount", "Net Amount"], rows }],
    });
  };

  const handleExportPDF = () => {
    const rows = months.map((r) => [r.month + " " + r.year, fmtNum(r.grossAmount), fmtNum(r.taxAmount), fmtNum(r.netAmount)]);
    rows.push(["Total", fmtNum(totals.grossAmount), fmtNum(totals.taxAmount), fmtNum(totals.netAmount)]);
    exportToPDF({
      fileName: `Sales-Register_${fmtDate(startDate)}_to_${fmtDate(endDate)}.pdf`,
      title: "Sales Register",
      subtitle: `${fmtDate(startDate)} - ${fmtDate(endDate)} | ${selectedCustomerName}`,
      sheets: [{ name: "Sales Register", headers: ["Month", "Gross Amount (₹)", "Tax Amount (₹)", "Net Amount (₹)"], rows }],
    });
  };

  // ── Handle month row click ─────────────────────────────────
  const handleMonthClick = (monthData: MonthData) => {
    const hasData = monthData.grossAmount > 0 || monthData.taxAmount > 0 || monthData.netAmount > 0;
    if (!hasData) return;

    const params = new URLSearchParams();
    params.append("month", String(monthData.monthIndex));
    params.append("year", String(monthData.year));
    if (customerId !== "all") params.append("customerId", customerId);

    router.push(`/reports/sales-register/details?${params}`);
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="p-6">
        {/* ── Top-right: fiscal year preset + date display ── */}
        <div className="flex items-center justify-end gap-3 mb-4">
          <ExportButtons onExportPDF={handleExportPDF} onExportExcel={handleExportExcel} disabled={isLoading || months.length === 0} />
          <Select
            value={period}
            onValueChange={(v) => setPeriod(v as Period)}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_fy">This Fiscal Year</SelectItem>
              <SelectItem value="last_fy">Last Fiscal Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-sm text-gray-500 whitespace-nowrap">
            {fmtDate(startDate)} &ndash; {fmtDate(endDate)}
          </span>
        </div>

        {/* ── Centred header ── */}
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Sales Register</h1>
          <p className="text-sm text-gray-500">Sales</p>
          <p className="text-sm text-gray-500">
            {fmtDate(startDate)} - {fmtDate(endDate)}
          </p>
        </div>

        {/* ── Customer dropdown button ── */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <button
              onClick={() => setShowCustomerDrop(!showCustomerDrop)}
              className="flex items-center gap-2 bg-amber-700 hover:bg-amber-800 text-white px-5 py-2 rounded-md text-sm font-medium shadow-sm"
            >
              <span>🏠</span>
              <span>{selectedCustomerName}</span>
              <ChevronDown className="h-4 w-4" />
            </button>

            {showCustomerDrop && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white border rounded-lg shadow-lg z-10 w-64 max-h-56 overflow-y-auto">
                <button
                  onClick={() => {
                    setCustomerId("all");
                    setShowCustomerDrop(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                    customerId === "all" ? "bg-teal-50 font-semibold text-teal-700" : "text-gray-700"
                  }`}
                >
                  All Customers
                </button>
                {customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCustomerId(c.id);
                      setShowCustomerDrop(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                      customerId === c.id ? "bg-teal-50 font-semibold text-teal-700" : "text-gray-700"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Custom date range inputs ── */}
        {period === "custom" && (
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm">From</Label>
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">To</Label>
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-44"
                min={customStart}
              />
            </div>
          </div>
        )}

        {/* ── Hint ── */}
        <p className="text-center text-xs text-gray-400 mb-2">
          Click on a month to view detailed transactions
        </p>

        {/* ── Main table ── */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading sales register…</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-100">
                    <TableHead className="font-semibold text-gray-700 w-[40%]">
                      Month
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">
                      Total Gross Amount (₹)
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">
                      Total Tax Amount (₹)
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">
                      Net Amount (₹)
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {months.map((row, idx) => {
                    const isCurrent = row.month === currentMonthName;
                    const hasData = row.grossAmount > 0 || row.taxAmount > 0 || row.netAmount > 0;

                    return (
                      <TableRow
                        key={idx}
                        className={`${isCurrent ? "bg-blue-50" : ""} ${hasData ? "cursor-pointer hover:bg-gray-50" : ""}`}
                        onClick={() => handleMonthClick(row)}
                      >
                        <TableCell
                          className={`font-medium ${
                            isCurrent ? "text-blue-800" : "text-gray-800"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {hasData && (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            {row.month} {row.year}
                          </div>
                        </TableCell>

                        <TableCell className="text-right text-gray-700">
                          {row.grossAmount > 0 ? fmt(row.grossAmount) : ""}
                        </TableCell>

                        <TableCell className="text-right text-gray-700">
                          {row.taxAmount > 0 ? fmt(row.taxAmount) : ""}
                        </TableCell>

                        <TableCell className="text-right font-semibold text-gray-900">
                          {row.netAmount > 0 ? fmt(row.netAmount) : ""}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* ── Total row ── */}
              <div className="border-t-2 border-gray-300 bg-gray-50">
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-bold text-gray-900 w-[40%]">
                        Total
                      </TableCell>
                      <TableCell className="text-right font-bold text-gray-900">
                        {totals.grossAmount > 0 ? fmt(totals.grossAmount) : ""}
                      </TableCell>
                      <TableCell className="text-right font-bold text-gray-900">
                        {totals.taxAmount > 0 ? fmt(totals.taxAmount) : ""}
                      </TableCell>
                      <TableCell className="text-right font-bold text-gray-900">
                        {totals.netAmount > 0 ? fmt(totals.netAmount) : ""}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
