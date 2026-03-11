"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Link from "next/link";
import { FileSpreadsheet, Calculator, GitCompareArrows, CalendarDays, ArrowRight, FileText } from "lucide-react";

const gstReports = [
  {
    title: "GSTR-1",
    description: "Monthly outward supplies — B2B, B2C, credit notes, and HSN summary.",
    href: "/gst/gstr-1",
    icon: FileSpreadsheet,
    color: "bg-indigo-500",
    lightColor: "bg-indigo-50",
    textColor: "text-indigo-700",
    borderColor: "border-indigo-200",
    hoverBorder: "hover:border-indigo-300",
    badge: "Monthly",
  },
  {
    title: "GSTR-3B",
    description: "Monthly summary return — output tax, input credit, and net tax payable.",
    href: "/gst/gstr-3b",
    icon: Calculator,
    color: "bg-orange-500",
    lightColor: "bg-orange-50",
    textColor: "text-orange-700",
    borderColor: "border-orange-200",
    hoverBorder: "hover:border-orange-300",
    badge: "Monthly",
  },
  {
    title: "GSTR-2 Reconciliation",
    description: "Purchase register for comparison with GSTR-2A/2B from GST portal.",
    href: "/gst/gstr-2",
    icon: GitCompareArrows,
    color: "bg-cyan-500",
    lightColor: "bg-cyan-50",
    textColor: "text-cyan-700",
    borderColor: "border-cyan-200",
    hoverBorder: "hover:border-cyan-300",
    badge: "Monthly",
  },
  {
    title: "GSTR-9 Annual",
    description: "Annual return — yearly summary of supplies, ITC, and tax paid.",
    href: "/gst/gstr-9",
    icon: CalendarDays,
    color: "bg-pink-500",
    lightColor: "bg-pink-50",
    textColor: "text-pink-700",
    borderColor: "border-pink-200",
    hoverBorder: "hover:border-pink-300",
    badge: "Annual",
  },
];

export default function GSTPage() {
  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-md">
              <FileText className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">GST</h1>
              <p className="text-sm text-gray-500">GST returns and compliance documents</p>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gstReports.map((report) => {
            const Icon = report.icon;
            return (
              <Link
                key={report.href}
                href={report.href}
                className={`group relative flex flex-col rounded-xl border ${report.borderColor} ${report.hoverBorder} bg-white p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${report.lightColor}`}>
                    <Icon className={`h-6 w-6 ${report.textColor}`} strokeWidth={1.8} />
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${report.lightColor} ${report.textColor}`}>
                    {report.badge}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{report.title}</h3>
                <p className="text-sm text-gray-500 flex-1 leading-relaxed">{report.description}</p>
                <div className={`flex items-center gap-1 mt-3 text-sm font-medium ${report.textColor}`}>
                  Open
                  <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
