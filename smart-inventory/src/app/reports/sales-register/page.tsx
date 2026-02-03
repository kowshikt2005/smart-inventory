"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useState, useMemo } from "react";
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
import { Loader2, ChevronDown } from "lucide-react";

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

// ── Page ────────────────────────────────────────────────────────
export default function SalesRegisterPage() {
  const currentFY = getCurrentFiscalYear();

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

  const months: {
    month: string;
    debit: number;
    credit: number;
    balance: number;
  }[] = data?.months || [];
  const totals = data?.totals || { debit: 0, credit: 0, balance: 0 };

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

  // ── Render ──────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="p-6">
        {/* ── Top-right: fiscal year preset + date display ── */}
        <div className="flex items-center justify-end gap-3 mb-4">
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

        {/* ── Customer dropdown button (styled like "Head Office") ── */}
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
                      Debit (₹)
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">
                      Credit (₹)
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">
                      Balance (₹)
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {months.map((row, idx) => {
                    const isCurrent = row.month === currentMonthName;
                    const hasData = row.debit > 0 || row.credit > 0;
                    const balCr = row.balance >= 0;

                    return (
                      <TableRow
                        key={idx}
                        className={isCurrent ? "bg-blue-100" : ""}
                      >
                        <TableCell
                          className={`font-medium ${
                            isCurrent ? "text-blue-800" : "text-gray-800"
                          }`}
                        >
                          {row.month}
                        </TableCell>

                        <TableCell className="text-right text-gray-700">
                          {row.debit > 0 ? fmt(row.debit) : ""}
                        </TableCell>

                        <TableCell className="text-right text-gray-700">
                          {row.credit > 0 ? fmt(row.credit) : ""}
                        </TableCell>

                        <TableCell className="text-right">
                          {hasData ? (
                            <span
                              className={`font-semibold ${
                                balCr ? "text-pink-600" : "text-blue-600"
                              }`}
                            >
                              {fmt(Math.abs(row.balance))}{" "}
                              <span className="text-xs font-normal">
                                {balCr ? "Cr" : "Dr"}
                              </span>
                            </span>
                          ) : (
                            ""
                          )}
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
                        {totals.debit > 0 ? fmt(totals.debit) : ""}
                      </TableCell>
                      <TableCell className="text-right font-bold text-gray-900">
                        {totals.credit > 0 ? fmt(totals.credit) : ""}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-bold ${
                            totals.balance >= 0
                              ? "text-pink-600"
                              : "text-blue-600"
                          }`}
                        >
                          {fmt(Math.abs(totals.balance))}{" "}
                          <span className="text-xs font-normal">
                            {totals.balance >= 0 ? "Cr" : "Dr"}
                          </span>
                        </span>
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
