"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  GSTMonthYearSelector,
  getDefaultMonthly,
} from "@/components/reports/GSTMonthYearSelector";
import { formatINR } from "@/lib/gst-report-utils";
import { Calculator, Loader2, AlertCircle, ChevronDown, ChevronUp, Download } from "lucide-react";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { exportToExcel, exportToPDF, generatePDFBase64, fmtNum, monthLabel, fetchCompanySettings } from "@/lib/export-utils";
import { EmailReportDialog } from "@/components/reports/EmailReportDialog";
import type { GSTR3BGovJSON } from "@/types/gst-gov-types";

// ─── Types matching API response ──────────────────────────────────────────────
interface TaxTriple { igst: number; cgst: number; sgst: number }
interface RateRow extends TaxTriple { rate: number; txval: number }
interface GSTR3BData {
  period: { month: string; year: number };
  govJson: GSTR3BGovJSON;
  display: {
    outwardSupplies: TaxTriple & { txval: number; rateWise: RateRow[] };
    itc: {
      available: TaxTriple;
      reversed: TaxTriple;
      net: TaxTriple;
    };
    taxPayable: {
      outputTax: TaxTriple;
      itcNet: TaxTriple;
      netPayable: TaxTriple & { total: number };
    };
  };
}

export default function GSTR3BPage() {
  const [period, setPeriod] = useState(getDefaultMonthly());
  const [data, setData] = useState<GSTR3BData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRateWise, setShowRateWise] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/reports/gstr-3b?month=${period.month}&year=${period.year}`);
        if (!res.ok) throw new Error("Failed to fetch");
        setData(await res.json());
      } catch {
        setError("Failed to load GSTR-3B data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period.month, period.year]);

  const handleDownloadJSON = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data.govJson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GSTR3B_${data.govJson.gstin}_${data.govJson.ret_period}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = async () => {
    if (!data) return;
    const d = data.display;
    const { company } = await fetchCompanySettings();
    const sheets = [
      {
        name: "Outward Supplies",
        headers: ["Description", "Taxable Value", "IGST", "CGST", "SGST"],
        rows: [
          ["Outward taxable supplies", d.outwardSupplies.txval, d.outwardSupplies.igst, d.outwardSupplies.cgst, d.outwardSupplies.sgst],
          ...d.outwardSupplies.rateWise.map((r) => [`Rate ${r.rate}%`, r.txval, r.igst, r.cgst, r.sgst]),
        ],
      },
      {
        name: "Eligible ITC",
        headers: ["Details", "IGST", "CGST", "SGST"],
        rows: [
          ["ITC Available (All other ITC)", d.itc.available.igst, d.itc.available.cgst, d.itc.available.sgst],
          ["ITC Reversed (Purchase Returns)", d.itc.reversed.igst, d.itc.reversed.cgst, d.itc.reversed.sgst],
          ["Net ITC", d.itc.net.igst, d.itc.net.cgst, d.itc.net.sgst],
        ],
      },
      {
        name: "Tax Payable",
        headers: ["Description", "IGST", "CGST", "SGST", "Total"],
        rows: [
          ["Output Tax", d.taxPayable.outputTax.igst, d.taxPayable.outputTax.cgst, d.taxPayable.outputTax.sgst, d.taxPayable.outputTax.igst + d.taxPayable.outputTax.cgst + d.taxPayable.outputTax.sgst],
          ["Less: ITC", d.taxPayable.itcNet.igst, d.taxPayable.itcNet.cgst, d.taxPayable.itcNet.sgst, d.taxPayable.itcNet.igst + d.taxPayable.itcNet.cgst + d.taxPayable.itcNet.sgst],
          ["Net Payable", d.taxPayable.netPayable.igst, d.taxPayable.netPayable.cgst, d.taxPayable.netPayable.sgst, d.taxPayable.netPayable.total],
        ],
      },
    ];
    exportToExcel({ fileName: `GSTR-3B_${monthLabel(period.month - 1, period.year)}.xlsx`, sheets, company });
  };

  const handleExportPDF = async () => {
    if (!data) return;
    const d = data.display;
    const { company } = await fetchCompanySettings();
    const sheets = [
      {
        name: "3.1 — Outward Supplies",
        headers: ["Description", "Taxable Value", "IGST", "CGST", "SGST"],
        rows: [
          ["Outward taxable supplies", fmtNum(d.outwardSupplies.txval), fmtNum(d.outwardSupplies.igst), fmtNum(d.outwardSupplies.cgst), fmtNum(d.outwardSupplies.sgst)],
          ...d.outwardSupplies.rateWise.map((r) => [`Rate ${r.rate}%`, fmtNum(r.txval), fmtNum(r.igst), fmtNum(r.cgst), fmtNum(r.sgst)]),
        ],
      },
      {
        name: "4 — Eligible ITC",
        headers: ["Details", "IGST", "CGST", "SGST"],
        rows: [
          ["ITC Available", fmtNum(d.itc.available.igst), fmtNum(d.itc.available.cgst), fmtNum(d.itc.available.sgst)],
          ["ITC Reversed", fmtNum(d.itc.reversed.igst), fmtNum(d.itc.reversed.cgst), fmtNum(d.itc.reversed.sgst)],
          ["Net ITC", fmtNum(d.itc.net.igst), fmtNum(d.itc.net.cgst), fmtNum(d.itc.net.sgst)],
        ],
      },
      {
        name: "6.1 — Tax Payable",
        headers: ["Description", "IGST", "CGST", "SGST", "Total"],
        rows: [
          ["Output Tax", fmtNum(d.taxPayable.outputTax.igst), fmtNum(d.taxPayable.outputTax.cgst), fmtNum(d.taxPayable.outputTax.sgst), fmtNum(d.taxPayable.outputTax.igst + d.taxPayable.outputTax.cgst + d.taxPayable.outputTax.sgst)],
          ["Less: ITC", fmtNum(d.taxPayable.itcNet.igst), fmtNum(d.taxPayable.itcNet.cgst), fmtNum(d.taxPayable.itcNet.sgst), fmtNum(d.taxPayable.itcNet.igst + d.taxPayable.itcNet.cgst + d.taxPayable.itcNet.sgst)],
          ["Net Payable", fmtNum(d.taxPayable.netPayable.igst), fmtNum(d.taxPayable.netPayable.cgst), fmtNum(d.taxPayable.netPayable.sgst), fmtNum(d.taxPayable.netPayable.total)],
        ],
      },
    ];
    exportToPDF({
      fileName: `GSTR-3B_${monthLabel(period.month - 1, period.year)}.pdf`,
      title: "GSTR-3B — Monthly Summary Return",
      subtitle: monthLabel(period.month - 1, period.year),
      sheets, company,
    });
  };

  const handleEmailSend = async (emails: string[], startDate: string) => {
    const month = new Date(startDate).getMonth() + 1;
    const year = new Date(startDate).getFullYear();
    const res = await fetch(`/api/reports/gstr-3b?month=${month}&year=${year}`);
    if (!res.ok) throw new Error("Failed to fetch report data");
    const emailData: GSTR3BData = await res.json();
    const { company } = await fetchCompanySettings();
    const d = emailData.display;
    const sheets = [
      { name: "3.1 — Outward Supplies", headers: ["Description", "Taxable Value", "IGST", "CGST", "SGST"], rows: [["Outward taxable supplies", fmtNum(d.outwardSupplies.txval), fmtNum(d.outwardSupplies.igst), fmtNum(d.outwardSupplies.cgst), fmtNum(d.outwardSupplies.sgst)], ...d.outwardSupplies.rateWise.map((r) => [`Rate ${r.rate}%`, fmtNum(r.txval), fmtNum(r.igst), fmtNum(r.cgst), fmtNum(r.sgst)])] },
      { name: "4 — Eligible ITC", headers: ["Details", "IGST", "CGST", "SGST"], rows: [["ITC Available", fmtNum(d.itc.available.igst), fmtNum(d.itc.available.cgst), fmtNum(d.itc.available.sgst)], ["ITC Reversed", fmtNum(d.itc.reversed.igst), fmtNum(d.itc.reversed.cgst), fmtNum(d.itc.reversed.sgst)], ["Net ITC", fmtNum(d.itc.net.igst), fmtNum(d.itc.net.cgst), fmtNum(d.itc.net.sgst)]] },
      { name: "6.1 — Tax Payable", headers: ["Description", "IGST", "CGST", "SGST", "Total"], rows: [["Output Tax", fmtNum(d.taxPayable.outputTax.igst), fmtNum(d.taxPayable.outputTax.cgst), fmtNum(d.taxPayable.outputTax.sgst), fmtNum(d.taxPayable.outputTax.igst + d.taxPayable.outputTax.cgst + d.taxPayable.outputTax.sgst)], ["Less: ITC", fmtNum(d.taxPayable.itcNet.igst), fmtNum(d.taxPayable.itcNet.cgst), fmtNum(d.taxPayable.itcNet.sgst), fmtNum(d.taxPayable.itcNet.igst + d.taxPayable.itcNet.cgst + d.taxPayable.itcNet.sgst)], ["Net Payable", fmtNum(d.taxPayable.netPayable.igst), fmtNum(d.taxPayable.netPayable.cgst), fmtNum(d.taxPayable.netPayable.sgst), fmtNum(d.taxPayable.netPayable.total)]] },
    ];
    const label = monthLabel(month - 1, year);
    const pdfBase64 = await generatePDFBase64({ title: "GSTR-3B — Monthly Summary Return", subtitle: label, sheets, company });
    const resp = await fetch("/api/reports/send-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails, subject: `GSTR-3B Report — ${label}`, pdfBase64, filename: `GSTR-3B_${label}.pdf`, reportTitle: "GSTR-3B — Monthly Summary Return" }) });
    if (!resp.ok) throw new Error("Failed to send email");
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-md">
              <Calculator className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">GSTR-3B</h1>
              <p className="text-sm text-gray-500">Monthly Summary Return</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadJSON}
              disabled={loading || !data}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 disabled:opacity-50 shadow-sm"
            >
              <Download className="h-4 w-4" />
              JSON
            </button>
            <ExportButtons onExportPDF={handleExportPDF} onExportExcel={handleExportExcel} disabled={loading || !data} />
            <EmailReportDialog
              reportTitle="GSTR-3B"
              defaultStartDate={`${period.year}-${String(period.month).padStart(2, "0")}-01`}
              defaultEndDate={`${period.year}-${String(period.month).padStart(2, "0")}-01`}
              hasDateFilter={true}
              onSendEmail={handleEmailSend}
              disabled={loading || !data}
            />
            <GSTMonthYearSelector mode="monthly" value={period} onChange={setPeriod} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-500 gap-2">
            <AlertCircle className="h-5 w-5" /><span>{error}</span>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Card 1: 3.1 — Outward Supplies */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">3.1 — Outward Supplies</h2>
              </div>
              <div className="p-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-3 py-2 font-medium text-gray-600">Description</th>
                      <th className="px-3 py-2 font-medium text-gray-600 text-right">Taxable Value</th>
                      <th className="px-3 py-2 font-medium text-gray-600 text-right">IGST</th>
                      <th className="px-3 py-2 font-medium text-gray-600 text-right">CGST</th>
                      <th className="px-3 py-2 font-medium text-gray-600 text-right">SGST</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="font-medium">
                      <td className="px-3 py-3">Outward taxable supplies (other than zero rated, nil rated and exempted)</td>
                      <td className="px-3 py-3 text-right">{formatINR(data.display.outwardSupplies.txval)}</td>
                      <td className="px-3 py-3 text-right">{formatINR(data.display.outwardSupplies.igst)}</td>
                      <td className="px-3 py-3 text-right">{formatINR(data.display.outwardSupplies.cgst)}</td>
                      <td className="px-3 py-3 text-right">{formatINR(data.display.outwardSupplies.sgst)}</td>
                    </tr>
                  </tbody>
                </table>

                {data.display.outwardSupplies.rateWise.length > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={() => setShowRateWise(!showRateWise)}
                      className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium"
                    >
                      {showRateWise ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      Rate-wise breakdown
                    </button>
                    {showRateWise && (
                      <table className="w-full text-sm mt-2">
                        <thead>
                          <tr className="bg-orange-50 text-left">
                            <th className="px-3 py-2 font-medium text-orange-700">Rate %</th>
                            <th className="px-3 py-2 font-medium text-orange-700 text-right">Taxable Value</th>
                            <th className="px-3 py-2 font-medium text-orange-700 text-right">IGST</th>
                            <th className="px-3 py-2 font-medium text-orange-700 text-right">CGST</th>
                            <th className="px-3 py-2 font-medium text-orange-700 text-right">SGST</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-orange-100">
                          {data.display.outwardSupplies.rateWise.map((r, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2">{r.rate}%</td>
                              <td className="px-3 py-2 text-right">{formatINR(r.txval)}</td>
                              <td className="px-3 py-2 text-right">{formatINR(r.igst)}</td>
                              <td className="px-3 py-2 text-right">{formatINR(r.cgst)}</td>
                              <td className="px-3 py-2 text-right">{formatINR(r.sgst)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: 4 — Eligible ITC */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">4 — Eligible ITC</h2>
              </div>
              <div className="p-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-3 py-2 font-medium text-gray-600">Details</th>
                      <th className="px-3 py-2 font-medium text-gray-600 text-right">IGST</th>
                      <th className="px-3 py-2 font-medium text-gray-600 text-right">CGST</th>
                      <th className="px-3 py-2 font-medium text-gray-600 text-right">SGST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="px-3 py-3">ITC Available (All other ITC)</td>
                      <td className="px-3 py-3 text-right">{formatINR(data.display.itc.available.igst)}</td>
                      <td className="px-3 py-3 text-right">{formatINR(data.display.itc.available.cgst)}</td>
                      <td className="px-3 py-3 text-right">{formatINR(data.display.itc.available.sgst)}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-3 text-red-600">ITC Reversed (Purchase Returns)</td>
                      <td className="px-3 py-3 text-right text-red-600">{formatINR(data.display.itc.reversed.igst)}</td>
                      <td className="px-3 py-3 text-right text-red-600">{formatINR(data.display.itc.reversed.cgst)}</td>
                      <td className="px-3 py-3 text-right text-red-600">{formatINR(data.display.itc.reversed.sgst)}</td>
                    </tr>
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-3 py-3">Net ITC</td>
                      <td className="px-3 py-3 text-right">{formatINR(data.display.itc.net.igst)}</td>
                      <td className="px-3 py-3 text-right">{formatINR(data.display.itc.net.cgst)}</td>
                      <td className="px-3 py-3 text-right">{formatINR(data.display.itc.net.sgst)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Card 3: 6.1 — Tax Payable */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">6.1 — Tax Payable</h2>
              </div>
              <div className="p-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-3 py-2 font-medium text-gray-600">Description</th>
                      <th className="px-3 py-2 font-medium text-gray-600 text-right">IGST</th>
                      <th className="px-3 py-2 font-medium text-gray-600 text-right">CGST</th>
                      <th className="px-3 py-2 font-medium text-gray-600 text-right">SGST</th>
                      <th className="px-3 py-2 font-medium text-gray-600 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="px-3 py-3">Output Tax Liability</td>
                      <td className="px-3 py-3 text-right">{formatINR(data.display.taxPayable.outputTax.igst)}</td>
                      <td className="px-3 py-3 text-right">{formatINR(data.display.taxPayable.outputTax.cgst)}</td>
                      <td className="px-3 py-3 text-right">{formatINR(data.display.taxPayable.outputTax.sgst)}</td>
                      <td className="px-3 py-3 text-right">{formatINR(data.display.taxPayable.outputTax.igst + data.display.taxPayable.outputTax.cgst + data.display.taxPayable.outputTax.sgst)}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-3 text-green-700">Less: Input Tax Credit</td>
                      <td className="px-3 py-3 text-right text-green-700">{formatINR(data.display.taxPayable.itcNet.igst)}</td>
                      <td className="px-3 py-3 text-right text-green-700">{formatINR(data.display.taxPayable.itcNet.cgst)}</td>
                      <td className="px-3 py-3 text-right text-green-700">{formatINR(data.display.taxPayable.itcNet.sgst)}</td>
                      <td className="px-3 py-3 text-right text-green-700">{formatINR(data.display.taxPayable.itcNet.igst + data.display.taxPayable.itcNet.cgst + data.display.taxPayable.itcNet.sgst)}</td>
                    </tr>
                    <tr className="bg-teal-50 font-bold text-teal-800">
                      <td className="px-3 py-3">Net Tax Payable</td>
                      <td className="px-3 py-3 text-right">{formatINR(data.display.taxPayable.netPayable.igst)}</td>
                      <td className="px-3 py-3 text-right">{formatINR(data.display.taxPayable.netPayable.cgst)}</td>
                      <td className="px-3 py-3 text-right">{formatINR(data.display.taxPayable.netPayable.sgst)}</td>
                      <td className="px-3 py-3 text-right">{formatINR(data.display.taxPayable.netPayable.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
