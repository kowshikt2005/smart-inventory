"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  GSTMonthYearSelector,
  getDefaultMonthly,
} from "@/components/reports/GSTMonthYearSelector";
import { formatINR } from "@/lib/gst-report-utils";
import { FileSpreadsheet, Loader2, AlertCircle, Download } from "lucide-react";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { exportToExcel, exportToPDF, fmtNum, monthLabel, fetchCompanySettings } from "@/lib/export-utils";
import type { GSTR1GovJSON, GovB2CS, GovHSNEntry, GovDocDetail } from "@/types/gst-gov-types";

// ─── Types matching API response ──────────────────────────────────────────────
interface DisplayB2B {
  ctin: string; name: string; inum: string; idt: string;
  pos: string; txval: number; igst: number; cgst: number; sgst: number; val: number;
}
interface DisplayCDNR {
  ctin: string; name: string; nt_num: string; nt_dt: string; ntty: string;
  pos: string; txval: number; igst: number; cgst: number; sgst: number; val: number;
}
interface GSTR1Data {
  period: { month: string; year: number };
  govJson: GSTR1GovJSON;
  display: {
    b2b: DisplayB2B[];
    b2cs: GovB2CS[];
    cdnr: DisplayCDNR[];
    hsn: { b2b: GovHSNEntry[]; b2c: GovHSNEntry[] };
    docIssue: GovDocDetail[];
    totalInvoices: number;
    totalCreditNotes: number;
    totalTxval: number;
    totalTax: number;
  };
}

const TABS = [
  { key: "b2b", label: "B2B Invoices" },
  { key: "b2cs", label: "B2C Supplies" },
  { key: "cdnr", label: "Credit Notes" },
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
        const res = await fetch(`/api/reports/gstr-1?month=${period.month}&year=${period.year}`);
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
      case "b2b": return data.display.b2b.length;
      case "b2cs": return data.display.b2cs.length;
      case "cdnr": return data.display.cdnr.length;
      case "hsn": return data.display.hsn.b2b.length + data.display.hsn.b2c.length;
      case "documents": return data.display.docIssue.length;
      default: return 0;
    }
  };

  const handleDownloadJSON = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data.govJson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GSTR1_${data.govJson.gstin}_${data.govJson.fp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = async () => {
    if (!data) return;
    const { company } = await fetchCompanySettings();
    const d = data.display;
    const sheets = [];
    if (d.b2b.length) sheets.push({
      name: "B2B", headers: ["GSTIN", "Receiver", "Invoice No", "Date", "POS", "Taxable Value", "IGST", "CGST", "SGST", "Total"],
      rows: d.b2b.map((r) => [r.ctin, r.name, r.inum, r.idt, r.pos, r.txval, r.igst, r.cgst, r.sgst, r.val]),
    });
    if (d.b2cs.length) sheets.push({
      name: "B2CS", headers: ["Supply Type", "POS", "Rate %", "Taxable Value", "IGST", "CGST", "SGST"],
      rows: d.b2cs.map((r) => [r.sply_ty, r.pos, r.rt, r.txval, r.iamt, r.camt, r.samt]),
    });
    if (d.cdnr.length) sheets.push({
      name: "CDNR", headers: ["GSTIN", "Receiver", "Note No", "Date", "POS", "Taxable Value", "IGST", "CGST", "SGST", "Total"],
      rows: d.cdnr.map((r) => [r.ctin, r.name, r.nt_num, r.nt_dt, r.pos, r.txval, r.igst, r.cgst, r.sgst, r.val]),
    });
    if (d.hsn.b2b.length) sheets.push({
      name: "HSN B2B", headers: ["HSN Code", "UQC", "Qty", "Taxable Value", "IGST", "CGST", "SGST", "Rate %"],
      rows: d.hsn.b2b.map((r) => [r.hsn_sc, r.uqc, r.qty, r.txval, r.iamt, r.camt, r.samt, r.rt]),
    });
    if (d.hsn.b2c.length) sheets.push({
      name: "HSN B2C", headers: ["HSN Code", "UQC", "Qty", "Taxable Value", "IGST", "CGST", "SGST", "Rate %"],
      rows: d.hsn.b2c.map((r) => [r.hsn_sc, r.uqc, r.qty, r.txval, r.iamt, r.camt, r.samt, r.rt]),
    });
    if (d.docIssue.length) sheets.push({
      name: "Documents", headers: ["Doc Type", "From", "To", "Total", "Cancelled", "Net Issued"],
      rows: d.docIssue.flatMap((dt) => dt.docs.map((doc) => [dt.doc_typ, doc.from, doc.to, doc.totnum, doc.cancel, doc.net_issue])),
    });
    exportToExcel({ fileName: `GSTR-1_${monthLabel(period.month - 1, period.year)}.xlsx`, sheets, company });
  };

  const handleExportPDF = async () => {
    if (!data) return;
    const { company } = await fetchCompanySettings();
    const d = data.display;
    const sheets = [];
    if (d.b2b.length) sheets.push({
      name: "B2B Invoices", headers: ["GSTIN", "Receiver", "Inv No", "Date", "POS", "Taxable", "IGST", "CGST", "SGST", "Total"],
      rows: d.b2b.map((r) => [r.ctin, r.name, r.inum, r.idt, r.pos, fmtNum(r.txval), fmtNum(r.igst), fmtNum(r.cgst), fmtNum(r.sgst), fmtNum(r.val)]),
    });
    if (d.b2cs.length) sheets.push({
      name: "B2C Supplies", headers: ["Type", "POS", "Rate%", "Taxable", "IGST", "CGST", "SGST"],
      rows: d.b2cs.map((r) => [r.sply_ty, r.pos, `${r.rt}%`, fmtNum(r.txval), fmtNum(r.iamt), fmtNum(r.camt), fmtNum(r.samt)]),
    });
    if (d.cdnr.length) sheets.push({
      name: "Credit Notes", headers: ["GSTIN", "Receiver", "Note No", "Date", "Taxable", "IGST", "CGST", "SGST", "Total"],
      rows: d.cdnr.map((r) => [r.ctin, r.name, r.nt_num, r.nt_dt, fmtNum(r.txval), fmtNum(r.igst), fmtNum(r.cgst), fmtNum(r.sgst), fmtNum(r.val)]),
    });
    if (d.hsn.b2b.length) sheets.push({
      name: "HSN B2B", headers: ["HSN", "UQC", "Qty", "Taxable", "IGST", "CGST", "SGST", "Rate"],
      rows: d.hsn.b2b.map((r) => [r.hsn_sc, r.uqc, r.qty, fmtNum(r.txval), fmtNum(r.iamt), fmtNum(r.camt), fmtNum(r.samt), `${r.rt}%`]),
    });
    if (d.hsn.b2c.length) sheets.push({
      name: "HSN B2C", headers: ["HSN", "UQC", "Qty", "Taxable", "IGST", "CGST", "SGST", "Rate"],
      rows: d.hsn.b2c.map((r) => [r.hsn_sc, r.uqc, r.qty, fmtNum(r.txval), fmtNum(r.iamt), fmtNum(r.camt), fmtNum(r.samt), `${r.rt}%`]),
    });
    exportToPDF({
      fileName: `GSTR-1_${monthLabel(period.month - 1, period.year)}.pdf`,
      title: "GSTR-1 — Outward Supplies",
      subtitle: monthLabel(period.month - 1, period.year),
      orientation: "landscape", sheets, company,
    });
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
              <p className="text-sm text-gray-500">Outward Supplies — Monthly return of sales</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadJSON}
              disabled={loading || !data}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 shadow-sm"
            >
              <Download className="h-4 w-4" />
              JSON
            </button>
            <ExportButtons onExportPDF={handleExportPDF} onExportExcel={handleExportExcel} disabled={loading || !data} />
            <GSTMonthYearSelector mode="monthly" value={period} onChange={setPeriod} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-500 gap-2">
            <AlertCircle className="h-5 w-5" /><span>{error}</span>
          </div>
        ) : data ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <SummaryCard label="Total Invoices" value={String(data.display.totalInvoices)} plain />
              <SummaryCard label="Taxable Value" value={formatINR(data.display.totalTxval)} />
              <SummaryCard label="Total Tax" value={formatINR(data.display.totalTax)} />
              <SummaryCard label="Credit Notes" value={String(data.display.totalCreditNotes)} plain />
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
                      <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                        activeTab === tab.key ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {getTabCount(tab.key)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4">
                {activeTab === "b2b" && <B2BTab data={data.display.b2b} />}
                {activeTab === "b2cs" && <B2CSTab data={data.display.b2cs} />}
                {activeTab === "cdnr" && <CDNRTab data={data.display.cdnr} />}
                {activeTab === "hsn" && <HSNTab b2b={data.display.hsn.b2b} b2c={data.display.hsn.b2c} />}
                {activeTab === "documents" && <DocumentsTab data={data.display.docIssue} />}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

// ─── Components ───────────────────────────────────────────────────────────────

function SummaryCard({ label, value, plain }: { label: string; value: string; plain?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${plain ? "text-gray-900" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function B2BTab({ data }: { data: DisplayB2B[] }) {
  if (!data.length) return <EmptyState message="No B2B invoices for this period" />;
  const totals = data.reduce(
    (acc, r) => ({ txval: acc.txval + r.txval, igst: acc.igst + r.igst, cgst: acc.cgst + r.cgst, sgst: acc.sgst + r.sgst, val: acc.val + r.val }),
    { txval: 0, igst: 0, cgst: 0, sgst: 0, val: 0 }
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="px-3 py-2 font-medium text-gray-600">GSTIN</th>
            <th className="px-3 py-2 font-medium text-gray-600">Receiver</th>
            <th className="px-3 py-2 font-medium text-gray-600">Invoice No</th>
            <th className="px-3 py-2 font-medium text-gray-600">Date</th>
            <th className="px-3 py-2 font-medium text-gray-600">POS</th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">Taxable Value</th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">IGST</th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">CGST</th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">SGST</th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-xs">{row.ctin}</td>
              <td className="px-3 py-2">{row.name}</td>
              <td className="px-3 py-2">{row.inum}</td>
              <td className="px-3 py-2">{row.idt}</td>
              <td className="px-3 py-2">{row.pos}</td>
              <td className="px-3 py-2 text-right">{formatINR(row.txval)}</td>
              <td className="px-3 py-2 text-right">{formatINR(row.igst)}</td>
              <td className="px-3 py-2 text-right">{formatINR(row.cgst)}</td>
              <td className="px-3 py-2 text-right">{formatINR(row.sgst)}</td>
              <td className="px-3 py-2 text-right font-medium">{formatINR(row.val)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-semibold">
            <td colSpan={5} className="px-3 py-2">Total</td>
            <td className="px-3 py-2 text-right">{formatINR(totals.txval)}</td>
            <td className="px-3 py-2 text-right">{formatINR(totals.igst)}</td>
            <td className="px-3 py-2 text-right">{formatINR(totals.cgst)}</td>
            <td className="px-3 py-2 text-right">{formatINR(totals.sgst)}</td>
            <td className="px-3 py-2 text-right">{formatINR(totals.val)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function B2CSTab({ data }: { data: GovB2CS[] }) {
  if (!data.length) return <EmptyState message="No B2C supplies for this period" />;
  const totals = data.reduce(
    (acc, r) => ({ txval: acc.txval + r.txval, iamt: acc.iamt + r.iamt, camt: acc.camt + r.camt, samt: acc.samt + r.samt }),
    { txval: 0, iamt: 0, camt: 0, samt: 0 }
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="px-3 py-2 font-medium text-gray-600">Supply Type</th>
            <th className="px-3 py-2 font-medium text-gray-600">POS</th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">Rate %</th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">Taxable Value</th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">IGST</th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">CGST</th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">SGST</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-3 py-2">
                <span className={`px-2 py-0.5 rounded-full text-xs ${row.sply_ty === "INTRA" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                  {row.sply_ty}
                </span>
              </td>
              <td className="px-3 py-2">{row.pos}</td>
              <td className="px-3 py-2 text-right">{row.rt}%</td>
              <td className="px-3 py-2 text-right">{formatINR(row.txval)}</td>
              <td className="px-3 py-2 text-right">{formatINR(row.iamt)}</td>
              <td className="px-3 py-2 text-right">{formatINR(row.camt)}</td>
              <td className="px-3 py-2 text-right">{formatINR(row.samt)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-semibold">
            <td colSpan={3} className="px-3 py-2">Total</td>
            <td className="px-3 py-2 text-right">{formatINR(totals.txval)}</td>
            <td className="px-3 py-2 text-right">{formatINR(totals.iamt)}</td>
            <td className="px-3 py-2 text-right">{formatINR(totals.camt)}</td>
            <td className="px-3 py-2 text-right">{formatINR(totals.samt)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function CDNRTab({ data }: { data: DisplayCDNR[] }) {
  if (!data.length) return <EmptyState message="No credit notes for this period" />;
  const totals = data.reduce(
    (acc, r) => ({ txval: acc.txval + r.txval, igst: acc.igst + r.igst, cgst: acc.cgst + r.cgst, sgst: acc.sgst + r.sgst, val: acc.val + r.val }),
    { txval: 0, igst: 0, cgst: 0, sgst: 0, val: 0 }
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="px-3 py-2 font-medium text-gray-600">GSTIN</th>
            <th className="px-3 py-2 font-medium text-gray-600">Receiver</th>
            <th className="px-3 py-2 font-medium text-gray-600">Note No</th>
            <th className="px-3 py-2 font-medium text-gray-600">Date</th>
            <th className="px-3 py-2 font-medium text-gray-600">POS</th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">Taxable</th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">IGST</th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">CGST</th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">SGST</th>
            <th className="px-3 py-2 font-medium text-gray-600 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-xs">{row.ctin}</td>
              <td className="px-3 py-2">{row.name}</td>
              <td className="px-3 py-2">{row.nt_num}</td>
              <td className="px-3 py-2">{row.nt_dt}</td>
              <td className="px-3 py-2">{row.pos}</td>
              <td className="px-3 py-2 text-right">{formatINR(row.txval)}</td>
              <td className="px-3 py-2 text-right">{formatINR(row.igst)}</td>
              <td className="px-3 py-2 text-right">{formatINR(row.cgst)}</td>
              <td className="px-3 py-2 text-right">{formatINR(row.sgst)}</td>
              <td className="px-3 py-2 text-right font-medium">{formatINR(row.val)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-semibold">
            <td colSpan={5} className="px-3 py-2">Total</td>
            <td className="px-3 py-2 text-right">{formatINR(totals.txval)}</td>
            <td className="px-3 py-2 text-right">{formatINR(totals.igst)}</td>
            <td className="px-3 py-2 text-right">{formatINR(totals.cgst)}</td>
            <td className="px-3 py-2 text-right">{formatINR(totals.sgst)}</td>
            <td className="px-3 py-2 text-right">{formatINR(totals.val)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function HSNTab({ b2b, b2c }: { b2b: GovHSNEntry[]; b2c: GovHSNEntry[] }) {
  if (!b2b.length && !b2c.length) return <EmptyState message="No HSN data for this period" />;
  return (
    <div className="space-y-6">
      {b2b.length > 0 && <HSNTable title="HSN — B2B" data={b2b} />}
      {b2c.length > 0 && <HSNTable title="HSN — B2C" data={b2c} />}
    </div>
  );
}

function HSNTable({ title, data }: { title: string; data: GovHSNEntry[] }) {
  const totals = data.reduce(
    (acc, r) => ({ qty: acc.qty + r.qty, txval: acc.txval + r.txval, iamt: acc.iamt + r.iamt, camt: acc.camt + r.camt, samt: acc.samt + r.samt }),
    { qty: 0, txval: 0, iamt: 0, camt: 0, samt: 0 }
  );
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-3 py-2 font-medium text-gray-600">HSN Code</th>
              <th className="px-3 py-2 font-medium text-gray-600">UQC</th>
              <th className="px-3 py-2 font-medium text-gray-600 text-right">Qty</th>
              <th className="px-3 py-2 font-medium text-gray-600 text-right">Taxable Value</th>
              <th className="px-3 py-2 font-medium text-gray-600 text-right">IGST</th>
              <th className="px-3 py-2 font-medium text-gray-600 text-right">CGST</th>
              <th className="px-3 py-2 font-medium text-gray-600 text-right">SGST</th>
              <th className="px-3 py-2 font-medium text-gray-600 text-right">Rate %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((row) => (
              <tr key={row.num} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono">{row.hsn_sc}</td>
                <td className="px-3 py-2">{row.uqc}</td>
                <td className="px-3 py-2 text-right">{row.qty}</td>
                <td className="px-3 py-2 text-right">{formatINR(row.txval)}</td>
                <td className="px-3 py-2 text-right">{formatINR(row.iamt)}</td>
                <td className="px-3 py-2 text-right">{formatINR(row.camt)}</td>
                <td className="px-3 py-2 text-right">{formatINR(row.samt)}</td>
                <td className="px-3 py-2 text-right">{row.rt}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-semibold">
              <td colSpan={2} className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-right">{totals.qty}</td>
              <td className="px-3 py-2 text-right">{formatINR(totals.txval)}</td>
              <td className="px-3 py-2 text-right">{formatINR(totals.iamt)}</td>
              <td className="px-3 py-2 text-right">{formatINR(totals.camt)}</td>
              <td className="px-3 py-2 text-right">{formatINR(totals.samt)}</td>
              <td className="px-3 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function DocumentsTab({ data }: { data: GovDocDetail[] }) {
  if (!data.length) return <EmptyState message="No document data for this period" />;
  return (
    <div className="space-y-4">
      {data.map((docType) => (
        <div key={docType.doc_num} className="bg-gray-50 rounded-lg p-5">
          <h3 className="font-semibold text-gray-900 mb-3">{docType.doc_typ}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium text-gray-600">From</th>
                  <th className="px-3 py-2 font-medium text-gray-600">To</th>
                  <th className="px-3 py-2 font-medium text-gray-600 text-right">Total</th>
                  <th className="px-3 py-2 font-medium text-gray-600 text-right">Cancelled</th>
                  <th className="px-3 py-2 font-medium text-gray-600 text-right">Net Issued</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {docType.docs.map((doc) => (
                  <tr key={doc.num}>
                    <td className="px-3 py-2 font-mono text-xs">{doc.from}</td>
                    <td className="px-3 py-2 font-mono text-xs">{doc.to}</td>
                    <td className="px-3 py-2 text-right">{doc.totnum}</td>
                    <td className="px-3 py-2 text-right text-red-600">{doc.cancel}</td>
                    <td className="px-3 py-2 text-right font-semibold text-indigo-600">{doc.net_issue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
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
