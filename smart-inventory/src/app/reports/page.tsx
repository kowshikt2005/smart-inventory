"use client";

import Link from "next/link";
import {
  FileText,
  BarChart3,
  ClipboardList,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Package,
} from "lucide-react";

const reports = [
  {
    title: "Sales Register",
    description: "Monthly sales summary with gross, tax, and net amounts. Drill down into individual transactions.",
    href: "/reports/sales-register",
    icon: TrendingUp,
    color: "bg-emerald-500",
    lightColor: "bg-emerald-50",
    textColor: "text-emerald-700",
    borderColor: "border-emerald-200",
    hoverBorder: "hover:border-emerald-300",
  },
  {
    title: "Purchase Register",
    description: "Monthly purchase overview by vendor. Track purchase invoices and amounts across periods.",
    href: "/reports/purchase-register",
    icon: TrendingDown,
    color: "bg-blue-500",
    lightColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    hoverBorder: "hover:border-blue-300",
  },
  {
    title: "Outstanding Report",
    description: "Track unpaid invoices for customers and vendors. See overdue amounts and aging details.",
    href: "/reports/outstanding",
    icon: AlertCircle,
    color: "bg-amber-500",
    lightColor: "bg-amber-50",
    textColor: "text-amber-700",
    borderColor: "border-amber-200",
    hoverBorder: "hover:border-amber-300",
  },
  {
    title: "Claim Report",
    description: "Analyse product claims based on selling price vs sold rate differences across invoices.",
    href: "/reports/claim-report",
    icon: FileText,
    color: "bg-violet-500",
    lightColor: "bg-violet-50",
    textColor: "text-violet-700",
    borderColor: "border-violet-200",
    hoverBorder: "hover:border-violet-300",
  },
  {
    title: "Billed & Unbilled",
    description: "View sales orders by billing status. Identify which orders are fully invoiced vs pending.",
    href: "/reports/billed-unbilled",
    icon: CheckCircle,
    color: "bg-rose-500",
    lightColor: "bg-rose-50",
    textColor: "text-rose-700",
    borderColor: "border-rose-200",
    hoverBorder: "hover:border-rose-300",
  },
  {
    title: "Closing Stock",
    description: "Current inventory levels with stock valuation at cost price. Filter by brand.",
    href: "/reports/closing-stock",
    icon: Package,
    color: "bg-teal-500",
    lightColor: "bg-teal-50",
    textColor: "text-teal-700",
    borderColor: "border-teal-200",
    hoverBorder: "hover:border-teal-300",
  },
];

export default function ReportsPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-md">
            <BarChart3 className="h-5 w-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-500">Choose a report to view</p>
          </div>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Link
              key={report.href}
              href={report.href}
              className={`group relative flex flex-col rounded-xl border ${report.borderColor} ${report.hoverBorder} bg-white p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5`}
            >
              {/* Icon */}
              <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${report.lightColor} mb-4`}>
                <Icon className={`h-5.5 w-5.5 ${report.textColor}`} strokeWidth={1.8} />
              </div>

              {/* Content */}
              <h3 className="text-base font-semibold text-gray-900 mb-1.5">
                {report.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed flex-1">
                {report.description}
              </p>

              {/* Arrow */}
              <div className="flex items-center gap-1.5 mt-4 text-sm font-medium text-gray-400 group-hover:text-gray-700 transition-colors">
                <span>View report</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
