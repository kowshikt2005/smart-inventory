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
  Building2,
  Truck,
  ClipboardList,
  BookOpen,
  Pencil,
  X,
  Check,
  Activity,
  LineChart,
  ArrowUpRight,
  ArrowDownRight,
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

type QuickAction = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ElementType;
  color: string;
  iconColor: string;
  hoverColor: string;
};

// ─── Activity helpers ──────────────────────────────────────────────────────
type ActivityEvent = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  amount: number | null;
  timestamp: string;
  user: string | null;
  href: string;
  details: Record<string, string | number | null | undefined>;
};

type ActivityResponse = {
  events: ActivityEvent[];
  nextScanAt: string;
};

function formatScanTime(date: Date): string {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === new Date(now.getTime() + 86400000).toDateString();
  const timeStr = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  if (isToday) return `Today at ${timeStr}`;
  if (isTomorrow) return `Tomorrow at ${timeStr}`;
  return date.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" }) + ` at ${timeStr}`;
}

function timeUntil(date: Date): string {
  const diff = date.getTime() - Date.now();
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 0) return `in ${hrs}h ${mins}m`;
  if (mins > 0) return `in ${mins}m`;
  return "very soon";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ACTIVITY_META: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  SALE:          { label: "Sale",       color: "text-indigo-600",  bg: "bg-indigo-50",  icon: Receipt      },
  SALES_ORDER:   { label: "Order",      color: "text-violet-600",  bg: "bg-violet-50",  icon: ShoppingCart },
  PAYMENT:       { label: "Receipt",    color: "text-emerald-600", bg: "bg-emerald-50", icon: CreditCard   },
  PURCHASE:      { label: "Purchase",   color: "text-amber-600",   bg: "bg-amber-50",   icon: Truck        },
  ADJUSTMENT_IN: { label: "Stock In",   color: "text-teal-600",    bg: "bg-teal-50",    icon: Package      },
  ADJUSTMENT_OUT:{ label: "Stock Out",  color: "text-orange-600",  bg: "bg-orange-50",  icon: Package      },
  RETURN:        { label: "Return",     color: "text-cyan-600",    bg: "bg-cyan-50",    icon: Package      },
  DAMAGE:        { label: "Damage",     color: "text-rose-600",    bg: "bg-rose-50",    icon: Package      },
  TRANSFER:      { label: "Transfer",   color: "text-slate-600",   bg: "bg-slate-50",   icon: Package      },
};

// ─── SVG Bar+Line chart ──────────────────────────────────────────────────────
type ChartPoint = { label: string; sales: number; purchases: number; profit: number; receipts: number };

function formatK(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 10000000) return `${sign}${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000)   return `${sign}${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000)     return `${sign}${(abs / 1000).toFixed(0)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

function DashboardChart({ data }: { data: ChartPoint[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: ChartPoint } | null>(null);

  const cH = 200, cW = 480, padL = 52, padB = 28, padT = 16, padR = 12;
  const totalW = cW + padL + padR;
  const totalH = cH + padT + padB;
  const slotW = cW / Math.max(data.length, 1);
  const barW = slotW * 0.28;

  const maxVal = Math.max(...data.flatMap((d) => [d.sales, d.purchases, Math.abs(d.profit)]), 1);
  const scale = (v: number) => cH - Math.max(v / maxVal, 0) * cH;
  const gridVals = [1, 0.75, 0.5, 0.25, 0].map((p) => ({ y: cH * (1 - p), val: maxVal * p }));

  const profitPoints = data
    .map((d, i) => `${padL + i * slotW + slotW / 2},${padT + scale(d.profit)}`)
    .join(" ");

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${totalW} ${totalH}`}
        className="w-full h-auto"
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Grid */}
        {gridVals.map((g, i) => (
          <g key={i}>
            <line x1={padL} y1={padT + g.y} x2={padL + cW} y2={padT + g.y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={padL - 6} y={padT + g.y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
              {formatK(g.val)}
            </text>
          </g>
        ))}

        {/* Bars */}
        {data.map((d, i) => {
          const x = padL + i * slotW + slotW * 0.08;
          const salesH = (d.sales / maxVal) * cH;
          const purchH = (d.purchases / maxVal) * cH;
          return (
            <g
              key={d.label}
              onMouseEnter={() => {
                setTooltip({ x: padL + i * slotW + slotW / 2, y: 0, point: d });
              }}
              className="cursor-pointer"
            >
              <rect x={x} y={padT + cH - salesH} width={barW} height={salesH} fill="#6366f1" rx="2" opacity="0.82" />
              <rect x={x + barW + 3} y={padT + cH - purchH} width={barW} height={purchH} fill="#8b5cf6" rx="2" opacity="0.82" />
              <text x={padL + i * slotW + slotW / 2} y={totalH - 4} textAnchor="middle" fontSize="9" fill="#94a3b8">
                {d.label}
              </text>
            </g>
          );
        })}

        {/* Profit line */}
        <polyline points={profitPoints} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle key={d.label} cx={padL + i * slotW + slotW / 2} cy={padT + scale(d.profit)} r="3.5" fill="#10b981" stroke="white" strokeWidth="1.5" />
        ))}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div className="absolute pointer-events-none z-10 bg-white border border-border rounded-lg shadow-lg p-3 text-xs min-w-[140px]"
          style={{ left: `${(tooltip.x / totalW) * 100}%`, top: "10%", transform: "translateX(-50%)" }}>
          <p className="font-semibold text-foreground mb-1.5">{tooltip.point.label}</p>
          <div className="space-y-1">
            <div className="flex justify-between gap-4"><span className="text-indigo-600">Sales</span><span className="font-medium">₹{formatK(tooltip.point.sales)}</span></div>
            <div className="flex justify-between gap-4"><span className="text-violet-600">Purchases</span><span className="font-medium">₹{formatK(tooltip.point.purchases)}</span></div>
            <div className="flex justify-between gap-4"><span className="text-emerald-600">Profit</span><span className={`font-medium ${tooltip.point.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>₹{formatK(tooltip.point.profit)}</span></div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 justify-center">
        {[{ color: "bg-indigo-500", label: "Sales" }, { color: "bg-violet-500", label: "Purchases" }, { color: "bg-emerald-500", label: "Profit" }].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
            <span className="text-xs text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const ALL_QUICK_ACTIONS: QuickAction[] = [
  { id: "new-sales-order",      label: "New Sales Order",      description: "Create a customer order",    href: "/sales/orders/new",        icon: ShoppingCart, color: "bg-indigo-50",  iconColor: "text-indigo-600",  hoverColor: "group-hover:bg-indigo-100"  },
  { id: "new-invoice",          label: "New Invoice",          description: "Bill a customer directly",   href: "/sales/invoices/new",       icon: Receipt,      color: "bg-violet-50",  iconColor: "text-violet-600",  hoverColor: "group-hover:bg-violet-100"  },
  { id: "new-purchase-order",   label: "New Purchase Order",   description: "Order from a vendor",        href: "/purchases/orders/new",     icon: Truck,        color: "bg-blue-50",    iconColor: "text-blue-600",    hoverColor: "group-hover:bg-blue-100"    },
  { id: "new-purchase-invoice", label: "New Purchase Invoice", description: "Record a vendor bill",       href: "/purchases/invoices/new",   icon: FileText,     color: "bg-purple-50",  iconColor: "text-purple-600",  hoverColor: "group-hover:bg-purple-100"  },
  { id: "manage-customers",     label: "Manage Customers",     description: "View & add customers",       href: "/masters/customers",        icon: Users,        color: "bg-amber-50",   iconColor: "text-amber-600",   hoverColor: "group-hover:bg-amber-100"   },
  { id: "manage-items",         label: "Manage Items",         description: "Inventory & pricing",        href: "/masters/items",            icon: Package,      color: "bg-emerald-50", iconColor: "text-emerald-600", hoverColor: "group-hover:bg-emerald-100" },
  { id: "manage-vendors",       label: "Manage Vendors",       description: "View & add vendors",         href: "/masters/vendors",          icon: Building2,    color: "bg-orange-50",  iconColor: "text-orange-600",  hoverColor: "group-hover:bg-orange-100"  },
  { id: "new-receipt",          label: "New Receipt",          description: "Record a payment received",  href: "/sales/receipts",           icon: CreditCard,   color: "bg-teal-50",    iconColor: "text-teal-600",    hoverColor: "group-hover:bg-teal-100"    },
  { id: "view-reports",         label: "View Reports",         description: "Sales & purchase reports",   href: "/reports",                  icon: BarChart3,    color: "bg-rose-50",    iconColor: "text-rose-600",    hoverColor: "group-hover:bg-rose-100"    },
  { id: "stock-ledger",         label: "Stock Ledger",         description: "Item-wise stock movements",  href: "/ledger/items",             icon: ClipboardList, color: "bg-cyan-50",   iconColor: "text-cyan-600",    hoverColor: "group-hover:bg-cyan-100"    },
  { id: "customer-ledger",      label: "Customer Ledger",      description: "Outstanding & payments",     href: "/ledger/customers",         icon: BookOpen,     color: "bg-pink-50",    iconColor: "text-pink-600",    hoverColor: "group-hover:bg-pink-100"    },
];

const DEFAULT_SELECTED = ["new-sales-order", "new-invoice", "manage-customers", "manage-items"];
const STORAGE_KEY = "dashboard_quick_actions";

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

  const [rightPanel, setRightPanel] = useState<"activity" | "charts">("activity");
  const [selectedActions, setSelectedActions] = useState<string[]>(DEFAULT_SELECTED);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(DEFAULT_SELECTED);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) setSelectedActions(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  const openEdit = () => { setDraft(selectedActions); setEditOpen(true); };

  const toggleDraft = (id: string) => {
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const saveEdit = () => {
    setSelectedActions(draft);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); } catch { /* ignore */ }
    setEditOpen(false);
  };

  const visibleActions = ALL_QUICK_ACTIONS.filter((a) => selectedActions.includes(a.id));

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

  const { data: activityResp, error: activityError } = useSWR<ActivityResponse>(
    "/api/dashboard/activity",
    { refreshInterval: 30000 }
  );
  const activityData = activityResp?.events;
  const nextScanAt = activityResp?.nextScanAt ? new Date(activityResp.nextScanAt) : null;

  const [selectedEvent, setSelectedEvent] = useState<ActivityEvent | null>(null);

  const { data: chartData } = useSWR<ChartPoint[]>(
    rightPanel === "charts" ? "/api/dashboard/charts" : null
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
              <button
                onClick={openEdit}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            </div>
            <div className="space-y-1">
              {visibleActions.map((action) => (
                <Link key={action.id} href={action.href} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                  <div className={`p-2 rounded-lg ${action.color} ${action.hoverColor} transition-colors`}>
                    <action.icon className={`h-4 w-4 ${action.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Edit Quick Actions Modal */}
          {editOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
                <div className="flex items-center justify-between p-5 border-b border-border">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Edit Quick Actions</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Select up to 4 actions to display</p>
                  </div>
                  <button onClick={() => setEditOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-4 space-y-1 max-h-[420px] overflow-y-auto">
                  {ALL_QUICK_ACTIONS.map((action) => {
                    const selected = draft.includes(action.id);
                    const disabled = !selected && draft.length >= 4;
                    return (
                      <button
                        key={action.id}
                        onClick={() => toggleDraft(action.id)}
                        disabled={disabled}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                          selected ? "bg-muted/60" : disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/40"
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${action.color} shrink-0`}>
                          <action.icon className={`h-4 w-4 ${action.iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{action.label}</p>
                          <p className="text-xs text-muted-foreground">{action.description}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          selected ? "bg-primary border-primary" : "border-border"
                        }`}>
                          {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between p-4 border-t border-border">
                  <span className="text-xs text-muted-foreground">{draft.length} / 4 selected</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
                    <Button size="sm" onClick={saveEdit} disabled={draft.length === 0}>Save</Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Right Panel — Activity or Charts */}
          <div className="bg-white rounded-xl border border-border/60 p-6 lg:col-span-2">
            {/* Panel Header with toggle */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">
                {rightPanel === "activity" ? "Recent Activity" : "Performance Overview"}
              </h3>
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
                <button
                  onClick={() => setRightPanel("activity")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    rightPanel === "activity" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Activity className="h-3 w-3" /> Activity
                </button>
                <button
                  onClick={() => setRightPanel("charts")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    rightPanel === "charts" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LineChart className="h-3 w-3" /> Charts
                </button>
              </div>
            </div>

            {/* Activity Feed */}
            {rightPanel === "activity" && (
              <div className="flex flex-col" style={{ maxHeight: 360 }}>
                {!activityData && !activityError && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
                    <p className="text-xs text-muted-foreground">Loading activity…</p>
                  </div>
                )}
                {activityError && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Activity className="h-10 w-10 text-muted-foreground/20 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">Could not load activity</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Will retry automatically</p>
                  </div>
                )}
                {activityData && activityData.length === 0 && (
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <Activity className="h-10 w-10 text-muted-foreground/20 mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">No activity in the last 30 days</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">New transactions will appear here as they happen</p>
                    </div>
                  </div>
                )}
                {activityData && activityData.length > 0 && (
                  <div className="space-y-0.5 overflow-y-auto flex-1 pr-1">
                    {activityData.map((event) => {
                      const meta = ACTIVITY_META[event.type] ?? { label: event.type, color: "text-slate-600", bg: "bg-slate-50", icon: FileText };
                      const Icon = meta.icon;
                      return (
                        <button
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors text-left cursor-pointer"
                        >
                          <div className={`p-2 rounded-lg ${meta.bg} shrink-0 mt-0.5`}>
                            <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                              {event.amount != null && (
                                <span className="text-xs font-semibold text-foreground shrink-0 flex items-center gap-0.5">
                                  {event.type === "PURCHASE" ? (
                                    <ArrowDownRight className="h-3 w-3 text-violet-500" />
                                  ) : event.type === "PAYMENT" ? (
                                    <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                                  ) : (
                                    <ArrowUpRight className="h-3 w-3 text-indigo-500" />
                                  )}
                                  ₹{formatK(event.amount)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-muted-foreground truncate">{event.subtitle}</p>
                              {event.user && (
                                <span className="text-xs text-muted-foreground/70 shrink-0">· by {event.user}</span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] text-muted-foreground/60 shrink-0 mt-0.5">{timeAgo(event.timestamp)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Stock scan footer — always visible */}
                {nextScanAt && (
                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2.5 shrink-0">
                    <div className="p-1.5 rounded-md bg-amber-50 shrink-0">
                      <ClipboardList className="h-3 w-3 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Stock scan</span>
                        {" · "}{formatScanTime(nextScanAt)}
                        <span className="text-muted-foreground/60"> ({timeUntil(nextScanAt)})</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Charts */}
            {rightPanel === "charts" && (
              <div>
                {!chartData && (
                  <div className="flex flex-col items-center justify-center py-10">
                    <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
                    <p className="text-xs text-muted-foreground">Loading chart data…</p>
                  </div>
                )}
                {chartData && chartData.length > 0 && (
                  <div>
                    {/* Summary row */}
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      {[
                        { label: "6-mo Sales",     value: chartData.reduce((s, d) => s + d.sales, 0),     color: "text-indigo-600" },
                        { label: "6-mo Purchases", value: chartData.reduce((s, d) => s + d.purchases, 0), color: "text-violet-600" },
                        { label: "6-mo Profit",    value: chartData.reduce((s, d) => s + d.profit, 0),    color: "text-emerald-600" },
                      ].map((s) => (
                        <div key={s.label} className="bg-muted/30 rounded-lg p-3">
                          <p className="text-[10px] text-muted-foreground">{s.label}</p>
                          <p className={`text-sm font-bold mt-0.5 ${s.color}`}>₹{formatK(s.value)}</p>
                        </div>
                      ))}
                    </div>
                    <DashboardChart data={chartData} />
                  </div>
                )}
                {chartData && chartData.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10">
                    <BarChart3 className="h-10 w-10 text-muted-foreground/20 mb-3" />
                    <p className="text-sm text-muted-foreground">No data yet</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Activity Detail Slide-over */}
      {selectedEvent && (() => {
        const meta = ACTIVITY_META[selectedEvent.type] ?? { label: selectedEvent.type, color: "text-slate-600", bg: "bg-slate-50", icon: FileText };
        const Icon = meta.icon;
        return (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
              onClick={() => setSelectedEvent(null)}
            />
            {/* Panel */}
            <div className="fixed right-0 top-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between p-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${meta.bg}`}>
                    <Icon className={`h-5 w-5 ${meta.color}`} />
                  </div>
                  <div>
                    <span className={`text-[10px] font-semibold uppercase tracking-widest ${meta.color}`}>{meta.label}</span>
                    <h2 className="text-sm font-semibold text-foreground leading-tight mt-0.5">{selectedEvent.title}</h2>
                  </div>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="text-muted-foreground hover:text-foreground transition-colors mt-0.5">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Amount (if any) */}
              {selectedEvent.amount != null && (
                <div className="px-5 py-4 border-b border-border bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-0.5">Amount</p>
                  <p className="text-2xl font-bold text-foreground">₹{Number(selectedEvent.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                </div>
              )}

              {/* Detail rows */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {Object.entries(selectedEvent.details).map(([key, val]) => (
                  val !== null && val !== undefined && String(val) !== "—" && String(val) !== "" ? (
                    <div key={key} className="flex items-start justify-between gap-4">
                      <span className="text-xs text-muted-foreground shrink-0 w-32">{key}</span>
                      <span className="text-xs font-medium text-foreground text-right break-all">{String(val)}</span>
                    </div>
                  ) : null
                ))}

                {/* Timestamps */}
                <div className="pt-3 border-t border-border space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-xs text-muted-foreground shrink-0 w-32">Recorded at</span>
                    <span className="text-xs font-medium text-foreground text-right">
                      {new Date(selectedEvent.timestamp).toLocaleString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit", hour12: true
                      })}
                    </span>
                  </div>
                  {selectedEvent.user && (
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-xs text-muted-foreground shrink-0 w-32">Recorded by</span>
                      <span className="text-xs font-medium text-foreground text-right">{selectedEvent.user}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-border">
                <Link
                  href={selectedEvent.href}
                  onClick={() => setSelectedEvent(null)}
                  className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary text-primary-foreground text-sm font-medium py-2.5 hover:bg-primary/90 transition-colors"
                >
                  View Full Details
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </>
        );
      })()}
    </DashboardLayout>
  );
}
