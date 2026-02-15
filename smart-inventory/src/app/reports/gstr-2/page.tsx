"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  GSTMonthYearSelector,
  getDefaultMonthly,
} from "@/components/reports/GSTMonthYearSelector";
import { formatINR } from "@/lib/gst-report-utils";
import { GitCompareArrows, Loader2, AlertCircle } from "lucide-react";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { exportToExcel, exportToPDF, fmtNum, fmtDateExport, monthLabel } from "@/lib/export-utils";

interface GSTR2Data {
  period: { month: string; year: number };
  invoices: Array<{
    vendorGstin: string;
    vendorName: string;
    invoiceNumber: string;
    date: string;
    placeOfSupply: string;
    taxableValue: number;
    cgst: number;
    sgst: number;
    total: number;
  }>;
  hsn: Array<{
    hsnCode: string;
    description: string;
    uqc: string;
    qty: number;
    taxableValue: number;
    cgst: number;
    sgst: number;
    rate: number;
  }>;
  summary: {
    totalInvoices: number;
    totalTaxableValue: number;
    totalCGST: number;
    totalSGST: number;
    totalValue: number;
  };
}

const TABS = [
  { key: "invoices", label: "Invoice Details" },
  { key: "hsn", label: "HSN Summary" },
] as const;

export default function GSTR2Page() {
  const [period, setPeriod] = useState(getDefaultMonthly());
  const [data, setData] = useState<GSTR2Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("invoices");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `/api/reports/gstr-2?month=${period.month}&year=${period.year}`
        );
        if (!res.ok) throw new Error("Failed to fetch");
        setData(await res.json());
      } catch {
        setError("Failed to load GSTR-2 data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period.month, period.year]);

  const handleExportExcel = () => {
    if (!data) return;
    const sheets = [];
    if (data.invoices.length) sheets.push({ name: "Invoices", headers: ["Vendor GSTIN", "Vendor Name", "Invoice No", "Date", "Place of Supply", "Taxable Value", "CGST", "SGST", "Total"], rows: data.invoices.map((r) => [r.vendorGstin, r.vendorName, r.invoiceNumber, fmtDateExport(r.date), r.placeOfSupply, r.taxableValue, r.cgst, r.sgst, r.total]) });
    if (data.hsn.length) sheets.push({ name: "HSN Summary", headers: ["HSN Code", "Description", "UQC", "Qty", "Taxable Value", "CGST", "SGST", "Rate %"], rows: data.hsn.map((r) => [r.hsnCode, r.description, r.uqc, r.qty, r.taxableValue, r.cgst, r.sgst, r.rate]) });
    if (sheets.length) exportToExcel({ fileName: `GSTR-2_${monthLabel(period.month - 1, period.year)}.xlsx`, sheets });
  };

  const handleExportPDF = () => {
    if (!data) return;
    const sheets = [];
    if (data.invoices.length) sheets.push({ name: "Invoices", headers: ["GSTIN", "Vendor", "Invoice", "Date", "POS", "Taxable", "CGST", "SGST", "Total"], rows: data.invoices.map((r) => [r.vendorGstin, r.vendorName, r.invoiceNumber, fmtDateExport(r.date), r.placeOfSupply, fmtNum(r.taxableValue), fmtNum(r.cgst), fmtNum(r.sgst), fmtNum(r.total)]) });
    if (data.hsn.length) sheets.push({ name: "HSN Summary", headers: ["HSN", "Description", "UQC", "Qty", "Taxable", "CGST", "SGST", "Rate"], rows: data.hsn.map((r) => [r.hsnCode, r.description, r.uqc, r.qty, fmtNum(r.taxableValue), fmtNum(r.cgst), fmtNum(r.sgst), `${r.rate}%`]) });
    if (sheets.length) exportToPDF({ fileName: `GSTR-2_${monthLabel(period.month - 1, period.year)}.pdf`, title: "GSTR-2 — Purchase Reconciliation", subtitle: monthLabel(period.month - 1, period.year), orientation: "landscape", sheets });
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 shadow-md">
              <GitCompareArrows className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">GSTR-2</h1>
              <p className="text-sm text-gray-500">
                Purchase Reconciliation — Compare with GSTR-2A/2B from portal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ExportButtons onExportPDF={handleExportPDF} onExportExcel={handleExportExcel} disabled={loading || !data} />
            <GSTMonthYearSelector
              mode="monthly"
              value={period}
              onChange={setPeriod}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-500 gap-2">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        ) : data ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <SummaryCard
                label="Total Invoices"
                value={String(data.summary.totalInvoices)}
              />
              <SummaryCard
                label="Taxable Value"
                value={formatINR(data.summary.totalTaxableValue)}
              />
              <SummaryCard
                label="Total CGST"
                value={formatINR(data.summary.totalCGST)}
              />
              <SummaryCard
                label="Total SGST"
                value={formatINR(data.summary.totalSGST)}
              />
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="border-b border-gray-200">
                <div className="flex">
                  {TABS.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                        activeTab === tab.key
                          ? "border-cyan-500 text-cyan-600"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {tab.label}
                      <span
                        className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                          activeTab === tab.key
                            ? "bg-cyan-100 text-cyan-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {tab.key === "invoices"
                          ? data.invoices.length
                          : data.hsn.length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4">
                {activeTab === "invoices" ? (
                  <InvoicesTab data={data.invoices} />
                ) : (
                  <HSNTab data={data.hsn} />
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function InvoicesTab({ data }: { data: GSTR2Data["invoices"] }) {
  if (!data.length)
    return <EmptyState message="No purchase invoices for this period" />;
  const totals = data.reduce(
    (acc, r) => ({
      taxableValue: acc.taxableValue + r.taxableValue,
      cgst: acc.cgst + r.cgst,
      sgst: acc.sgst + r.sgst,
      total: acc.total + r.total,
    }),
    { taxableValue: 0, cgst: 0, sgst: 0, total: 0 }
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="px-3 py-2 font-medium text-gray-600">
              Vendor GSTIN
            </th>
            <th className="px-3 py-2 font-medium text-gray-600">
              Vendor Name
            </th>
            <th className="px-3 py-2 font-medium text-gray-600">Invoice No</th>
            <th className="px-3 py-2 font-medium text-gray-600">Date</th>
            <th className="px-3 py-2 font-medium text-gray-600">
              Place of Supply
            </th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">
              Taxable Value
            </th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">
              CGST
            </th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">
              SGST
            </th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-xs">
                {row.vendorGstin}
              </td>
              <td className="px-3 py-2">{row.vendorName}</td>
              <td className="px-3 py-2">{row.invoiceNumber}</td>
              <td className="px-3 py-2">
                {new Date(row.date).toLocaleDateString("en-IN")}
              </td>
              <td className="px-3 py-2">{row.placeOfSupply}</td>
              <td className="px-3 py-2 text-right">
                {formatINR(row.taxableValue)}
              </td>
              <td className="px-3 py-2 text-right">{formatINR(row.cgst)}</td>
              <td className="px-3 py-2 text-right">{formatINR(row.sgst)}</td>
              <td className="px-3 py-2 text-right font-medium">
                {formatINR(row.total)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-semibold">
            <td colSpan={5} className="px-3 py-2">
              Total
            </td>
            <td className="px-3 py-2 text-right">
              {formatINR(totals.taxableValue)}
            </td>
            <td className="px-3 py-2 text-right">{formatINR(totals.cgst)}</td>
            <td className="px-3 py-2 text-right">{formatINR(totals.sgst)}</td>
            <td className="px-3 py-2 text-right">{formatINR(totals.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function HSNTab({ data }: { data: GSTR2Data["hsn"] }) {
  if (!data.length)
    return <EmptyState message="No HSN data for this period" />;
  const totals = data.reduce(
    (acc, r) => ({
      qty: acc.qty + r.qty,
      taxableValue: acc.taxableValue + r.taxableValue,
      cgst: acc.cgst + r.cgst,
      sgst: acc.sgst + r.sgst,
    }),
    { qty: 0, taxableValue: 0, cgst: 0, sgst: 0 }
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="px-3 py-2 font-medium text-gray-600">HSN Code</th>
            <th className="px-3 py-2 font-medium text-gray-600">
              Description
            </th>
            <th className="px-3 py-2 font-medium text-gray-600">UQC</th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">
              Qty
            </th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">
              Taxable Value
            </th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">
              CGST
            </th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">
              SGST
            </th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">
              Rate %
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono">{row.hsnCode}</td>
              <td className="px-3 py-2">{row.description}</td>
              <td className="px-3 py-2">{row.uqc}</td>
              <td className="px-3 py-2 text-right">{row.qty}</td>
              <td className="px-3 py-2 text-right">
                {formatINR(row.taxableValue)}
              </td>
              <td className="px-3 py-2 text-right">{formatINR(row.cgst)}</td>
              <td className="px-3 py-2 text-right">{formatINR(row.sgst)}</td>
              <td className="px-3 py-2 text-right">{row.rate}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-semibold">
            <td colSpan={3} className="px-3 py-2">
              Total
            </td>
            <td className="px-3 py-2 text-right">{totals.qty}</td>
            <td className="px-3 py-2 text-right">
              {formatINR(totals.taxableValue)}
            </td>
            <td className="px-3 py-2 text-right">{formatINR(totals.cgst)}</td>
            <td className="px-3 py-2 text-right">{formatINR(totals.sgst)}</td>
            <td className="px-3 py-2"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <AlertCircle className="h-8 w-8 mb-2" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
