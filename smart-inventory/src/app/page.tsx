"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState, useEffect, useRef, useCallback } from "react";
import useSWR from "swr";
import {
  Calendar,
  ChevronDown,
  DollarSign,
  FileText,
  CreditCard,
  TrendingUp,
  ShoppingCart,
  Receipt,
  Users,
  Package,
  BarChart3,
} from "lucide-react";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function toDateString(date: Date) {
  return date.toISOString().split("T")[0];
}

function getPresetRange(preset: string) {
  const now = new Date();
  switch (preset) {
    case "this-month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: toDateString(first), to: toDateString(last), label: "This Month" };
    }
    case "last-month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toDateString(first), to: toDateString(last), label: "Last Month" };
    }
    case "this-quarter": {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const first = new Date(now.getFullYear(), qMonth, 1);
      const last = new Date(now.getFullYear(), qMonth + 3, 0);
      return { from: toDateString(first), to: toDateString(last), label: "This Quarter" };
    }
    case "this-year": {
      // Indian financial year: Apr 1 - Mar 31
      const fyStart = now.getMonth() >= 3
        ? new Date(now.getFullYear(), 3, 1)
        : new Date(now.getFullYear() - 1, 3, 1);
      const fyEnd = now.getMonth() >= 3
        ? new Date(now.getFullYear() + 1, 2, 31)
        : new Date(now.getFullYear(), 2, 31);
      return { from: toDateString(fyStart), to: toDateString(fyEnd), label: "This FY" };
    }
    case "all-time": {
      return { from: "2020-01-01", to: toDateString(now), label: "All Time" };
    }
    default: {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: toDateString(first), to: toDateString(last), label: "This Month" };
    }
  }
}

function _formatDisplayDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatCurrency(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 10000000) {
    return `${sign}${(abs / 10000000).toFixed(2)} Cr`;
  }
  if (abs >= 100000) {
    return `${sign}${(abs / 100000).toFixed(2)} L`;
  }
  return `${sign}${abs.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function AnimatedNumber({ value, prefix = "₹" }: { value: number; prefix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValue = useRef(0);
  const rafRef = useRef<number | null>(null);

  const animate = useCallback((from: number, to: number) => {
    const duration = 800;
    const startTime = performance.now();

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    animate(prevValue.current, value);
    prevValue.current = value;
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, animate]);

  return (
    <span>
      {prefix}
      {formatCurrency(displayValue)}
    </span>
  );
}

const PRESETS = [
  { key: "this-month", label: "This Month" },
  { key: "last-month", label: "Last Month" },
  { key: "this-quarter", label: "This Quarter" },
  { key: "this-year", label: "This FY" },
  { key: "all-time", label: "All Time" },
];

export default function HomePage() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] || "there";

  const defaultRange = getPresetRange("this-month");
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);
  const [activePreset, setActivePreset] = useState("this-month");
  const [showPresets, setShowPresets] = useState(false);
  const presetsRef = useRef<HTMLDivElement>(null);

  // Close presets dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) {
        setShowPresets(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handlePreset = (key: string) => {
    const range = getPresetRange(key);
    setFromDate(range.from);
    setToDate(range.to);
    setActivePreset(key);
    setShowPresets(false);
  };

  const handleFromChange = (val: string) => {
    setFromDate(val);
    setActivePreset("custom");
  };

  const handleToChange = (val: string) => {
    setToDate(val);
    setActivePreset("custom");
  };

  const { data: stats } = useSWR(
    `/api/dashboard/stats?fromDate=${fromDate}&toDate=${toDate}`
  );

  const totalSales = stats?.totalSales ?? 0;
  const totalPurchases = stats?.totalPurchases ?? 0;
  const totalReceivables = stats?.totalReceivables ?? 0;
  const netProfit = stats?.netProfit ?? 0;

  const presetLabel = PRESETS.find((p) => p.key === activePreset)?.label || "Custom";

  return (
    <DashboardLayout>
      <div className="p-8 animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {getGreeting()}, {firstName}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Here&apos;s what&apos;s happening with your business today.
            </p>
          </div>

          {/* Date Range Controls */}
          <div className="flex items-center gap-2">
            {/* Preset Dropdown */}
            <div className="relative" ref={presetsRef}>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShowPresets(!showPresets)}
              >
                {presetLabel}
                <ChevronDown className="h-4 w-4" />
              </Button>
              {showPresets && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg border border-border shadow-lg z-50 py-1">
                  {PRESETS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => handlePreset(p.key)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-muted/50 transition-colors ${
                        activePreset === p.key ? "text-primary font-medium bg-muted/30" : "text-foreground"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date Inputs */}
            <div className="flex items-center gap-1.5 bg-white border border-border rounded-lg px-3 py-1.5">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => handleFromChange(e.target.value)}
                className="text-sm bg-transparent outline-none w-[120px] text-foreground"
              />
              <span className="text-muted-foreground text-sm">-</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => handleToChange(e.target.value)}
                className="text-sm bg-transparent outline-none w-[120px] text-foreground"
              />
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Sales */}
          <div className="bg-white rounded-xl border border-border/60 overflow-hidden hover:shadow-lg transition-all duration-300 group">
            <div className="h-1 bg-gradient-to-r from-indigo-500 to-indigo-600" />
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Total Sales</p>
                  <p className="text-3xl font-bold text-foreground mt-2 tracking-tight">
                    <AnimatedNumber value={totalSales} />
                  </p>
                  {stats && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.salesCount} invoice{stats.salesCount !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
                <div className="p-3 bg-indigo-50 rounded-xl group-hover:bg-indigo-100 transition-colors">
                  <DollarSign className="h-6 w-6 text-indigo-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Total Purchases */}
          <div className="bg-white rounded-xl border border-border/60 overflow-hidden hover:shadow-lg transition-all duration-300 group">
            <div className="h-1 bg-gradient-to-r from-violet-500 to-violet-600" />
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Total Purchases</p>
                  <p className="text-3xl font-bold text-foreground mt-2 tracking-tight">
                    <AnimatedNumber value={totalPurchases} />
                  </p>
                  {stats && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.purchasesCount} invoice{stats.purchasesCount !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
                <div className="p-3 bg-violet-50 rounded-xl group-hover:bg-violet-100 transition-colors">
                  <FileText className="h-6 w-6 text-violet-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Total Receivables */}
          <div className="bg-white rounded-xl border border-border/60 overflow-hidden hover:shadow-lg transition-all duration-300 group">
            <div className="h-1 bg-gradient-to-r from-amber-500 to-amber-600" />
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Receivables</p>
                  <p className="text-3xl font-bold text-foreground mt-2 tracking-tight">
                    <AnimatedNumber value={totalReceivables} />
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Outstanding from customers
                  </p>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl group-hover:bg-amber-100 transition-colors">
                  <CreditCard className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Net Profit */}
          <div className="bg-white rounded-xl border border-border/60 overflow-hidden hover:shadow-lg transition-all duration-300 group">
            <div className="h-1 bg-gradient-to-r from-emerald-500 to-emerald-600" />
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Net Profit</p>
                  <p className={`text-3xl font-bold mt-2 tracking-tight ${netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    <AnimatedNumber value={netProfit} />
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sales - Purchases
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
                  <TrendingUp className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-border/60 p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Quick Actions</h3>
            <div className="space-y-1">
              <Link href="/sales/orders/new" className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                <div className="p-2 rounded-lg bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
                  <ShoppingCart className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">New Sales Order</p>
                  <p className="text-xs text-muted-foreground">Create a customer order</p>
                </div>
              </Link>
              <Link href="/sales/invoices" className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                <div className="p-2 rounded-lg bg-violet-50 group-hover:bg-violet-100 transition-colors">
                  <Receipt className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">New Invoice</p>
                  <p className="text-xs text-muted-foreground">Bill a customer</p>
                </div>
              </Link>
              <Link href="/masters/customers" className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                <div className="p-2 rounded-lg bg-amber-50 group-hover:bg-amber-100 transition-colors">
                  <Users className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Manage Customers</p>
                  <p className="text-xs text-muted-foreground">View & add customers</p>
                </div>
              </Link>
              <Link href="/masters/items" className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                <div className="p-2 rounded-lg bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
                  <Package className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Manage Items</p>
                  <p className="text-xs text-muted-foreground">Inventory & pricing</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl border border-border/60 p-6 lg:col-span-2">
            <h3 className="text-sm font-semibold text-foreground mb-4">Recent Activity</h3>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <p className="text-sm font-medium text-muted-foreground">No recent activity</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Start adding transactions to see your activity feed here
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
