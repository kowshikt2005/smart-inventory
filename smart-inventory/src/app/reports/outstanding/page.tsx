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
import { Loader2, ChevronDown } from "lucide-react";

interface OutstandingInvoice {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  balanceAmount: number;
  daysOverdue: number;
  customerId: string;
  customerName: string;
  creditDays: number;
}

interface Summary {
  totalCustomers: number;
  totalInvoices: number;
  totalOutstanding: number;
}

export default function OutstandingReportPage() {
  const [customerId, setCustomerId] = useState("all");
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);

  // ── Customer list for filter ──────────────────────────────
  const { data: customersData } = useSWR("/api/customers?limit=500");
  const customers: { id: string; name: string }[] =
    customersData?.customers || [];

  const selectedCustomerName =
    customerId === "all"
      ? "All Customers"
      : customers.find((c) => c.id === customerId)?.name || "All Customers";

  // ── API query ─────────────────────────────────────────────
  const queryString = useMemo(() => {
    if (customerId === "all") return "";
    return `customerId=${customerId}`;
  }, [customerId]);

  const { data, isLoading } = useSWR(
    `/api/reports/outstanding${queryString ? `?${queryString}` : ""}`
  );

  const invoices: OutstandingInvoice[] = data?.invoices || [];
  const summary: Summary = data?.summary || {
    totalCustomers: 0,
    totalInvoices: 0,
    totalOutstanding: 0,
  };

  // ── Helpers ───────────────────────────────────────────────
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const fmtDate = (s: string) => {
    if (!s) return "—";
    const [y, m, d] = s.split("-");
    return `${d}-${m}-${y}`;
  };

  const getOverdueBadgeClass = (days: number) => {
    if (days <= 30) return "bg-amber-100 text-amber-700";
    if (days <= 60) return "bg-orange-100 text-orange-700";
    return "bg-red-100 text-red-700";
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="p-6">
        {/* ── Header ── */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Outstanding Report</h1>
          <p className="text-sm text-gray-500">
            Customers with payments overdue beyond their credit days
          </p>
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Customers Overdue</p>
            <p className="text-2xl font-bold text-red-600">{summary.totalCustomers}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Overdue Invoices</p>
            <p className="text-2xl font-bold text-orange-600">{summary.totalInvoices}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Total Outstanding (₹)</p>
            <p className="text-2xl font-bold text-red-600">₹{fmt(summary.totalOutstanding)}</p>
          </div>
        </div>

        {/* ── Customer dropdown ── */}
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
                    customerId === "all"
                      ? "bg-teal-50 font-semibold text-teal-700"
                      : "text-gray-700"
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
                      customerId === c.id
                        ? "bg-teal-50 font-semibold text-teal-700"
                        : "text-gray-700"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="flex justify-center gap-4 mb-4">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-amber-100 border border-amber-300" />
            <span className="text-xs text-gray-500">1–30 days</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-orange-100 border border-orange-300" />
            <span className="text-xs text-gray-500">31–60 days</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-red-100 border border-red-300" />
            <span className="text-xs text-gray-500">60+ days</span>
          </div>
        </div>

        {/* ── Main table ── */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading outstanding report…</span>
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <p className="text-lg font-medium">No overdue invoices</p>
              <p className="text-sm mt-1">All customers are within their credit days</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-100">
                    <TableHead className="font-semibold text-gray-700">Customer</TableHead>
                    <TableHead className="font-semibold text-gray-700">Invoice No</TableHead>
                    <TableHead className="font-semibold text-gray-700">Invoice Date</TableHead>
                    <TableHead className="font-semibold text-gray-700">Due Date</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Amount (₹)</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Outstanding (₹)</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-center">Overdue</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.invoiceId}>
                      <TableCell className="font-medium text-gray-800">
                        {inv.customerName}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {inv.invoiceNumber}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {fmtDate(inv.invoiceDate)}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {fmtDate(inv.dueDate)}
                      </TableCell>
                      <TableCell className="text-right text-gray-700">
                        {fmt(inv.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {fmt(inv.balanceAmount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${getOverdueBadgeClass(inv.daysOverdue)}`}
                        >
                          {inv.daysOverdue} days
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* ── Total row ── */}
              <div className="border-t-2 border-gray-300 bg-gray-50">
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-bold text-gray-900">Total</TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell />
                      <TableCell className="text-right font-bold text-gray-900">
                        {fmt(invoices.reduce((sum, inv) => sum + inv.totalAmount, 0))}
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        {fmt(invoices.reduce((sum, inv) => sum + inv.balanceAmount, 0))}
                      </TableCell>
                      <TableCell />
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
