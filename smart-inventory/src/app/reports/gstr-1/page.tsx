"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  GSTMonthYearSelector,
  getDefaultMonthly,
} from "@/components/reports/GSTMonthYearSelector";
import { formatINR } from "@/lib/gst-report-utils";
import { FileSpreadsheet, Loader2, AlertCircle } from "lucide-react";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { exportToExcel, exportToPDF, fmtNum, fmtDateExport, monthLabel } from "@/lib/export-utils";

interface GSTR1Data {
  period: { month: string; year: number };
  b2b: Array<{
    invoiceNumber: string;
    date: string;
    customerGstin: string;
    customerName: string;
    placeOfSupply: string;
    taxableValue: number;
    cgst: number;
    sgst: number;
    total: number;
  }>;
  b2cLarge: Array<{
    placeOfSupply: string;
    rate: number;
    taxableValue: number;
    cgst: number;
    sgst: number;
    count: number;
  }>;
  b2cSmall: Array<{
    rate: number;
    taxableValue: number;
    cgst: number;
    sgst: number;
  }>;
  cdnr: Array<{
    noteNumber: string;
    noteDate: string;
    noteType: string;
    originalInvoice: string;
    customerGstin: string;
    customerName: string;
    taxableValue: number;
    cgst: number;
    sgst: number;
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
  documents: {
    from: string;
    to: string;
    total: number;
    cancelled: number;
    netIssued: number;
  };
  summary: {
    totalB2B: number;
    totalB2CLarge: number;
    totalB2CSmall: number;
    totalCDNR: number;
    totalTaxableValue: number;
    totalTax: number;
  };
}

const TABS = [
  { key: "b2b", label: "B2B Invoices" },
  { key: "b2cLarge", label: "B2C (Large)" },
  { key: "b2cSmall", label: "B2C (Small)" },
  { key: "cdnr", label: "Credit/Debit Notes" },
  { key: "hsn", label: "HSN Summary" },
  { key: "documents", label: "Documents" },
] as const;

export default function GSTR1Page() {
  const [period, setPeriod] = useState(getDefaultMonthly());
  const [data, setData] = useState<GSTR1Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("b2b");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `/api/reports/gstr-1?month=${period.month}&year=${period.year}`
        );
        if (!res.ok) throw new Error("Failed to fetch");
        setData(await res.json());
      } catch {
        setError("Failed to load GSTR-1 data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period.month, period.year]);

  const getTabCount = (key: string): number => {
    if (!data) return 0;
    switch (key) {
      case "b2b": return data.b2b.length;
      case "b2cLarge": return data.b2cLarge.length;
      case "b2cSmall": return data.b2cSmall.length;
      case "cdnr": return data.cdnr.length;
      case "hsn": return data.hsn.length;
      case "documents": return 1;
      default: return 0;
    }
  };

  const handleExportExcel = () => {
    if (!data) return;
    const sheets = [];
    if (data.b2b.length) sheets.push({ name: "B2B", headers: ["GSTIN", "Receiver", "Invoice No", "Date", "Place of Supply", "Taxable Value", "CGST", "SGST", "Total"], rows: data.b2b.map((r) => [r.customerGstin, r.customerName, r.invoiceNumber, fmtDateExport(r.date), r.placeOfSupply, r.taxableValue, r.cgst, r.sgst, r.total]) });
    if (data.b2cLarge.length) sheets.push({ name: "B2C Large", headers: ["Place of Supply", "Rate %", "Taxable Value", "CGST", "SGST", "Invoice Count"], rows: data.b2cLarge.map((r) => [r.placeOfSupply, r.rate, r.taxableValue, r.cgst, r.sgst, r.count]) });
    if (data.b2cSmall.length) sheets.push({ name: "B2C Small", headers: ["Rate %", "Taxable Value", "CGST", "SGST"], rows: data.b2cSmall.map((r) => [r.rate, r.taxableValue, r.cgst, r.sgst]) });
    if (data.cdnr.length) sheets.push({ name: "CDNR", headers: ["Note No", "Date", "Type", "Original Invoice", "GSTIN", "Receiver", "Taxable Value", "CGST", "SGST"], rows: data.cdnr.map((r) => [r.noteNumber, fmtDateExport(r.noteDate), r.noteType, r.originalInvoice, r.customerGstin, r.customerName, r.taxableValue, r.cgst, r.sgst]) });
    if (data.hsn.length) sheets.push({ name: "HSN", headers: ["HSN Code", "Description", "UQC", "Qty", "Taxable Value", "CGST", "SGST", "Rate %"], rows: data.hsn.map((r) => [r.hsnCode, r.description, r.uqc, r.qty, r.taxableValue, r.cgst, r.sgst, r.rate]) });
    sheets.push({ name: "Documents", headers: ["From", "To", "Total", "Cancelled", "Net Issued"], rows: [[data.documents.from, data.documents.to, data.documents.total, data.documents.cancelled, data.documents.netIssued]] });
    exportToExcel({ fileName: `GSTR-1_${monthLabel(period.month - 1, period.year)}.xlsx`, sheets });
  };

  const handleExportPDF = () => {
    if (!data) return;
    const sheets = [];
    if (data.b2b.length) sheets.push({ name: "B2B Invoices", headers: ["GSTIN", "Receiver", "Invoice No", "Date", "POS", "Taxable", "CGST", "SGST", "Total"], rows: data.b2b.map((r) => [r.customerGstin, r.customerName, r.invoiceNumber, fmtDateExport(r.date), r.placeOfSupply, fmtNum(r.taxableValue), fmtNum(r.cgst), fmtNum(r.sgst), fmtNum(r.total)]) });
    if (data.b2cLarge.length) sheets.push({ name: "B2C Large", headers: ["Place of Supply", "Rate %", "Taxable Value", "CGST", "SGST", "Count"], rows: data.b2cLarge.map((r) => [r.placeOfSupply, `${r.rate}%`, fmtNum(r.taxableValue), fmtNum(r.cgst), fmtNum(r.sgst), r.count]) });
    if (data.b2cSmall.length) sheets.push({ name: "B2C Small", headers: ["Rate %", "Taxable Value", "CGST", "SGST"], rows: data.b2cSmall.map((r) => [`${r.rate}%`, fmtNum(r.taxableValue), fmtNum(r.cgst), fmtNum(r.sgst)]) });
    if (data.cdnr.length) sheets.push({ name: "Credit/Debit Notes", headers: ["Note No", "Date", "Orig Invoice", "GSTIN", "Receiver", "Taxable", "CGST", "SGST"], rows: data.cdnr.map((r) => [r.noteNumber, fmtDateExport(r.noteDate), r.originalInvoice, r.customerGstin, r.customerName, fmtNum(r.taxableValue), fmtNum(r.cgst), fmtNum(r.sgst)]) });
    if (data.hsn.length) sheets.push({ name: "HSN Summary", headers: ["HSN", "Description", "UQC", "Qty", "Taxable", "CGST", "SGST", "Rate"], rows: data.hsn.map((r) => [r.hsnCode, r.description, r.uqc, r.qty, fmtNum(r.taxableValue), fmtNum(r.cgst), fmtNum(r.sgst), `${r.rate}%`]) });
    exportToPDF({ fileName: `GSTR-1_${monthLabel(period.month - 1, period.year)}.pdf`, title: "GSTR-1 — Outward Supplies", subtitle: monthLabel(period.month - 1, period.year), orientation: "landscape", sheets });
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-md">
              <FileSpreadsheet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">GSTR-1</h1>
              <p className="text-sm text-gray-500">
                Outward Supplies — Monthly return of sales
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
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
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
                value={String(data.documents.netIssued)}
                plain
              />
              <SummaryCard
                label="Taxable Value"
                value={formatINR(data.summary.totalTaxableValue)}
              />
              <SummaryCard
                label="Total Tax"
                value={formatINR(data.summary.totalTax)}
              />
              <SummaryCard
                label="Net Value"
                value={formatINR(
                  data.summary.totalTaxableValue + data.summary.totalTax
                )}
              />
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="border-b border-gray-200 overflow-x-auto">
                <div className="flex">
                  {TABS.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                        activeTab === tab.key
                          ? "border-indigo-500 text-indigo-600"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {tab.label}
                      <span
                        className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                          activeTab === tab.key
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {getTabCount(tab.key)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4">
                {activeTab === "b2b" && <B2BTab data={data.b2b} />}
                {activeTab === "b2cLarge" && (
                  <B2CLargeTab data={data.b2cLarge} />
                )}
                {activeTab === "b2cSmall" && (
                  <B2CSmallTab data={data.b2cSmall} />
                )}
                {activeTab === "cdnr" && <CDNRTab data={data.cdnr} />}
                {activeTab === "hsn" && <HSNTab data={data.hsn} />}
                {activeTab === "documents" && (
                  <DocumentsTab data={data.documents} />
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

function SummaryCard({
  label,
  value,
  plain,
}: {
  label: string;
  value: string;
  plain?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${plain ? "text-gray-900" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}

function B2BTab({ data }: { data: GSTR1Data["b2b"] }) {
  if (!data.length)
    return <EmptyState message="No B2B invoices for this period" />;
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
            <th className="px-3 py-2 font-medium text-gray-600">GSTIN</th>
            <th className="px-3 py-2 font-medium text-gray-600">
              Receiver Name
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
                {row.customerGstin}
              </td>
              <td className="px-3 py-2">{row.customerName}</td>
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

function B2CLargeTab({ data }: { data: GSTR1Data["b2cLarge"] }) {
  if (!data.length)
    return <EmptyState message="No B2C (Large) invoices for this period" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="px-3 py-2 font-medium text-gray-600">
              Place of Supply
            </th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">
              Rate %
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
              Invoice Count
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-3 py-2">{row.placeOfSupply}</td>
              <td className="px-3 py-2 text-right">{row.rate}%</td>
              <td className="px-3 py-2 text-right">
                {formatINR(row.taxableValue)}
              </td>
              <td className="px-3 py-2 text-right">{formatINR(row.cgst)}</td>
              <td className="px-3 py-2 text-right">{formatINR(row.sgst)}</td>
              <td className="px-3 py-2 text-right">{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function B2CSmallTab({ data }: { data: GSTR1Data["b2cSmall"] }) {
  if (!data.length)
    return <EmptyState message="No B2C (Small) invoices for this period" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="px-3 py-2 font-medium text-gray-600 text-right">
              Rate %
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
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-right">{row.rate}%</td>
              <td className="px-3 py-2 text-right">
                {formatINR(row.taxableValue)}
              </td>
              <td className="px-3 py-2 text-right">{formatINR(row.cgst)}</td>
              <td className="px-3 py-2 text-right">{formatINR(row.sgst)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CDNRTab({ data }: { data: GSTR1Data["cdnr"] }) {
  if (!data.length)
    return <EmptyState message="No credit/debit notes for this period" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="px-3 py-2 font-medium text-gray-600">Note No</th>
            <th className="px-3 py-2 font-medium text-gray-600">Date</th>
            <th className="px-3 py-2 font-medium text-gray-600">Type</th>
            <th className="px-3 py-2 font-medium text-gray-600">
              Original Invoice
            </th>
            <th className="px-3 py-2 font-medium text-gray-600">GSTIN</th>
            <th className="px-3 py-2 font-medium text-gray-600">Receiver</th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">
              Taxable Value
            </th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">
              CGST
            </th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">
              SGST
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-3 py-2">{row.noteNumber}</td>
              <td className="px-3 py-2">
                {new Date(row.noteDate).toLocaleDateString("en-IN")}
              </td>
              <td className="px-3 py-2">
                <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                  Credit
                </span>
              </td>
              <td className="px-3 py-2">{row.originalInvoice}</td>
              <td className="px-3 py-2 font-mono text-xs">
                {row.customerGstin}
              </td>
              <td className="px-3 py-2">{row.customerName}</td>
              <td className="px-3 py-2 text-right">
                {formatINR(row.taxableValue)}
              </td>
              <td className="px-3 py-2 text-right">{formatINR(row.cgst)}</td>
              <td className="px-3 py-2 text-right">{formatINR(row.sgst)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HSNTab({ data }: { data: GSTR1Data["hsn"] }) {
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

function DocumentsTab({
  data,
}: {
  data: GSTR1Data["documents"];
}) {
  return (
    <div className="max-w-md">
      <div className="bg-gray-50 rounded-lg p-5 space-y-3">
        <h3 className="font-semibold text-gray-900 mb-4">
          Invoice Document Summary
        </h3>
        <div className="flex justify-between">
          <span className="text-gray-600">From</span>
          <span className="font-medium">{data.from}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">To</span>
          <span className="font-medium">{data.to}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Total</span>
          <span className="font-medium">{data.total}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Cancelled</span>
          <span className="font-medium text-red-600">{data.cancelled}</span>
        </div>
        <hr className="border-gray-200" />
        <div className="flex justify-between">
          <span className="text-gray-900 font-semibold">Net Issued</span>
          <span className="font-bold text-indigo-600">{data.netIssued}</span>
        </div>
      </div>
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
