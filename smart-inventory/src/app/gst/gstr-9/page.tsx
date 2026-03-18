"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  GSTMonthYearSelector,
  getDefaultAnnual,
} from "@/components/reports/GSTMonthYearSelector";
import { formatINR } from "@/lib/gst-report-utils";
import { CalendarDays, Loader2, AlertCircle } from "lucide-react";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { exportToExcel, exportToPDF, generatePDFBase64, fmtNum, fetchCompanySettings } from "@/lib/export-utils";
import { EmailReportDialog } from "@/components/reports/EmailReportDialog";

interface GSTR9Data {
  financialYear: string;
  partII: {
    totalSales: {
      count: number;
      value: number;
      taxableValue: number;
      cgst: number;
      sgst: number;
    };
    b2b: { count: number; value: number };
    b2c: { count: number; value: number };
    creditNotes: { count: number; value: number; tax: number };
    netOutward: { value: number; tax: number };
  };
  partIII: {
    totalPurchases: {
      count: number;
      value: number;
      taxableValue: number;
      cgst: number;
      sgst: number;
    };
    debitNotes: { count: number; value: number; tax: number };
    netITC: { cgst: number; sgst: number };
  };
  partIV: {
    output: { cgst: number; sgst: number };
    input: { cgst: number; sgst: number };
    net: { cgst: number; sgst: number; total: number };
  };
  monthly: Array<{
    month: string;
    salesValue: number;
    salesTax: number;
    purchaseValue: number;
    purchaseTax: number;
    netTax: number;
  }>;
}

export default function GSTR9Page() {
  const [period, setPeriod] = useState(getDefaultAnnual());
  const [data, setData] = useState<GSTR9Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/reports/gstr-9?fy=${period.fy}`);
        if (!res.ok) throw new Error("Failed to fetch");
        setData(await res.json());
      } catch {
        setError("Failed to load GSTR-9 data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period.fy]);

  const handleExportExcel = async () => {
    if (!data) return;
    const { company } = await fetchCompanySettings();
    const sheets = [
      { name: "Part II - Outward", headers: ["Description", "Count", "Value", "Taxable Value", "CGST", "SGST"], rows: [["Total Sales", data.partII.totalSales.count, data.partII.totalSales.value, data.partII.totalSales.taxableValue, data.partII.totalSales.cgst, data.partII.totalSales.sgst], ["B2B Sales", data.partII.b2b.count, data.partII.b2b.value, "", "", ""], ["B2C Sales", data.partII.b2c.count, data.partII.b2c.value, "", "", ""], ["Credit Notes", data.partII.creditNotes.count, data.partII.creditNotes.value, "", "", data.partII.creditNotes.tax], ["Net Outward", "", data.partII.netOutward.value, "", "", data.partII.netOutward.tax]] },
      { name: "Part III - ITC", headers: ["Description", "Count", "Value", "Taxable Value", "CGST", "SGST"], rows: [["Total Purchases", data.partIII.totalPurchases.count, data.partIII.totalPurchases.value, data.partIII.totalPurchases.taxableValue, data.partIII.totalPurchases.cgst, data.partIII.totalPurchases.sgst], ["Debit Notes", data.partIII.debitNotes.count, data.partIII.debitNotes.value, "", "", data.partIII.debitNotes.tax], ["Net ITC", "", "", "", data.partIII.netITC.cgst, data.partIII.netITC.sgst]] },
      { name: "Part IV - Tax Payable", headers: ["Description", "CGST", "SGST", "Total"], rows: [["Output Tax", data.partIV.output.cgst, data.partIV.output.sgst, data.partIV.output.cgst + data.partIV.output.sgst], ["Less: ITC", data.partIV.input.cgst, data.partIV.input.sgst, data.partIV.input.cgst + data.partIV.input.sgst], ["Net Tax Payable", data.partIV.net.cgst, data.partIV.net.sgst, data.partIV.net.total]] },
      { name: "Monthly Breakdown", headers: ["Month", "Sales Value", "Sales Tax", "Purchase Value", "Purchase Tax", "Net Tax"], rows: data.monthly.map((r) => [r.month, r.salesValue, r.salesTax, r.purchaseValue, r.purchaseTax, r.netTax]) },
    ];
    exportToExcel({ fileName: `GSTR-9_FY-${period.fy}.xlsx`, sheets, company });
  };

  const handleExportPDF = async () => {
    if (!data) return;
    const { company } = await fetchCompanySettings();
    const sheets = [
      { name: "Part II — Outward Supplies", headers: ["Description", "Count", "Value", "Taxable", "CGST", "SGST"], rows: [["Total Sales", data.partII.totalSales.count, fmtNum(data.partII.totalSales.value), fmtNum(data.partII.totalSales.taxableValue), fmtNum(data.partII.totalSales.cgst), fmtNum(data.partII.totalSales.sgst)], ["B2B Sales", data.partII.b2b.count, fmtNum(data.partII.b2b.value), "", "", ""], ["B2C Sales", data.partII.b2c.count, fmtNum(data.partII.b2c.value), "", "", ""], ["Credit Notes", data.partII.creditNotes.count, fmtNum(data.partII.creditNotes.value), "", "", fmtNum(data.partII.creditNotes.tax)], ["Net Outward", "", fmtNum(data.partII.netOutward.value), "", "", fmtNum(data.partII.netOutward.tax)]] },
      { name: "Part IV — Tax Payable", headers: ["Description", "CGST", "SGST", "Total"], rows: [["Output Tax", fmtNum(data.partIV.output.cgst), fmtNum(data.partIV.output.sgst), fmtNum(data.partIV.output.cgst + data.partIV.output.sgst)], ["Less: ITC", fmtNum(data.partIV.input.cgst), fmtNum(data.partIV.input.sgst), fmtNum(data.partIV.input.cgst + data.partIV.input.sgst)], ["Net Tax", fmtNum(data.partIV.net.cgst), fmtNum(data.partIV.net.sgst), fmtNum(data.partIV.net.total)]] },
      { name: "Monthly Breakdown", headers: ["Month", "Sales Value", "Sales Tax", "Purchase Value", "Purchase Tax", "Net Tax"], rows: data.monthly.map((r) => [r.month, fmtNum(r.salesValue), fmtNum(r.salesTax), fmtNum(r.purchaseValue), fmtNum(r.purchaseTax), fmtNum(r.netTax)]) },
    ];
    exportToPDF({ fileName: `GSTR-9_FY-${period.fy}.pdf`, title: "GSTR-9 — Annual Return", subtitle: `Financial Year ${period.fy}`, sheets, company });
  };

  const handleEmailSend = async (emails: string[]) => {
    if (!data) return;
    const { company } = await fetchCompanySettings();
    const sheets = [
      { name: "Part II — Outward Supplies", headers: ["Description", "Count", "Value", "Taxable", "CGST", "SGST"], rows: [["Total Sales", data.partII.totalSales.count, fmtNum(data.partII.totalSales.value), fmtNum(data.partII.totalSales.taxableValue), fmtNum(data.partII.totalSales.cgst), fmtNum(data.partII.totalSales.sgst)], ["B2B Sales", data.partII.b2b.count, fmtNum(data.partII.b2b.value), "", "", ""], ["B2C Sales", data.partII.b2c.count, fmtNum(data.partII.b2c.value), "", "", ""], ["Credit Notes", data.partII.creditNotes.count, fmtNum(data.partII.creditNotes.value), "", "", fmtNum(data.partII.creditNotes.tax)], ["Net Outward", "", fmtNum(data.partII.netOutward.value), "", "", fmtNum(data.partII.netOutward.tax)]] },
      { name: "Part IV — Tax Payable", headers: ["Description", "CGST", "SGST", "Total"], rows: [["Output Tax", fmtNum(data.partIV.output.cgst), fmtNum(data.partIV.output.sgst), fmtNum(data.partIV.output.cgst + data.partIV.output.sgst)], ["Less: ITC", fmtNum(data.partIV.input.cgst), fmtNum(data.partIV.input.sgst), fmtNum(data.partIV.input.cgst + data.partIV.input.sgst)], ["Net Tax", fmtNum(data.partIV.net.cgst), fmtNum(data.partIV.net.sgst), fmtNum(data.partIV.net.total)]] },
      { name: "Monthly Breakdown", headers: ["Month", "Sales Value", "Sales Tax", "Purchase Value", "Purchase Tax", "Net Tax"], rows: data.monthly.map((r) => [r.month, fmtNum(r.salesValue), fmtNum(r.salesTax), fmtNum(r.purchaseValue), fmtNum(r.purchaseTax), fmtNum(r.netTax)]) },
    ];
    const pdfBase64 = await generatePDFBase64({ title: "GSTR-9 — Annual Return", subtitle: `Financial Year ${period.fy}`, sheets, company });
    const resp = await fetch("/api/reports/send-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails, subject: `GSTR-9 Annual Return — FY ${period.fy}`, pdfBase64, filename: `GSTR-9_FY-${period.fy}.pdf`, reportTitle: "GSTR-9 — Annual Return" }) });
    if (!resp.ok) throw new Error("Failed to send email");
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 shadow-md">
              <CalendarDays className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">GSTR-9</h1>
              <p className="text-sm text-gray-500">
                Annual Return — Yearly summary of supplies, ITC, and tax paid
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ExportButtons onExportPDF={handleExportPDF} onExportExcel={handleExportExcel} disabled={loading || !data} />
            <EmailReportDialog
              reportTitle="GSTR-9"
              hasDateFilter={false}
              onSendEmail={handleEmailSend}
              disabled={loading || !data}
            />
            <GSTMonthYearSelector
              mode="annual"
              value={period}
              onChange={setPeriod}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-500 gap-2">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Part II — Outward Supplies */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">
                  Part II — Outward Supplies
                </h2>
              </div>
              <div className="p-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-3 py-2 font-medium text-gray-600">
                        Description
                      </th>
                      <th className="px-3 py-2 font-medium text-gray-600 text-right">
                        Count
                      </th>
                      <th className="px-3 py-2 font-medium text-gray-600 text-right">
                        Value
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
                    <tr>
                      <td className="px-3 py-2 font-medium">Total Sales</td>
                      <td className="px-3 py-2 text-right">
                        {data.partII.totalSales.count}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partII.totalSales.value)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partII.totalSales.taxableValue)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partII.totalSales.cgst)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partII.totalSales.sgst)}
                      </td>
                    </tr>
                    <tr className="bg-gray-50/50">
                      <td className="px-3 py-2 pl-6 text-gray-600">
                        B2B Sales
                      </td>
                      <td className="px-3 py-2 text-right">
                        {data.partII.b2b.count}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partII.b2b.value)}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                    <tr className="bg-gray-50/50">
                      <td className="px-3 py-2 pl-6 text-gray-600">
                        B2C Sales
                      </td>
                      <td className="px-3 py-2 text-right">
                        {data.partII.b2c.count}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partII.b2c.value)}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                    <tr className="text-red-600">
                      <td className="px-3 py-2">Credit Notes</td>
                      <td className="px-3 py-2 text-right">
                        {data.partII.creditNotes.count}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partII.creditNotes.value)}
                      </td>
                      <td colSpan={2}></td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partII.creditNotes.tax)}
                      </td>
                    </tr>
                    <tr className="bg-pink-50 font-semibold">
                      <td className="px-3 py-2">Net Outward Supplies</td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partII.netOutward.value)}
                      </td>
                      <td colSpan={2}></td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partII.netOutward.tax)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Part III — Input Tax Credit */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">
                  Part III — Input Tax Credit
                </h2>
              </div>
              <div className="p-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-3 py-2 font-medium text-gray-600">
                        Description
                      </th>
                      <th className="px-3 py-2 font-medium text-gray-600 text-right">
                        Count
                      </th>
                      <th className="px-3 py-2 font-medium text-gray-600 text-right">
                        Value
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
                    <tr>
                      <td className="px-3 py-2 font-medium">
                        Total Purchases
                      </td>
                      <td className="px-3 py-2 text-right">
                        {data.partIII.totalPurchases.count}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partIII.totalPurchases.value)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partIII.totalPurchases.taxableValue)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partIII.totalPurchases.cgst)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partIII.totalPurchases.sgst)}
                      </td>
                    </tr>
                    <tr className="text-red-600">
                      <td className="px-3 py-2">Debit Notes</td>
                      <td className="px-3 py-2 text-right">
                        {data.partIII.debitNotes.count}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partIII.debitNotes.value)}
                      </td>
                      <td colSpan={2}></td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partIII.debitNotes.tax)}
                      </td>
                    </tr>
                    <tr className="bg-pink-50 font-semibold">
                      <td className="px-3 py-2">Net ITC Available</td>
                      <td colSpan={3}></td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partIII.netITC.cgst)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partIII.netITC.sgst)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Part IV — Tax Payable */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">
                  Part IV — Tax Payable
                </h2>
              </div>
              <div className="p-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-3 py-2 font-medium text-gray-600">
                        Description
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
                    <tr>
                      <td className="px-3 py-2">Output Tax Liability</td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partIV.output.cgst)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partIV.output.sgst)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(
                          data.partIV.output.cgst + data.partIV.output.sgst
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-green-700">
                        Less: Input Tax Credit
                      </td>
                      <td className="px-3 py-2 text-right text-green-700">
                        {formatINR(data.partIV.input.cgst)}
                      </td>
                      <td className="px-3 py-2 text-right text-green-700">
                        {formatINR(data.partIV.input.sgst)}
                      </td>
                      <td className="px-3 py-2 text-right text-green-700">
                        {formatINR(
                          data.partIV.input.cgst + data.partIV.input.sgst
                        )}
                      </td>
                    </tr>
                    <tr className="bg-teal-50 font-bold text-teal-800">
                      <td className="px-3 py-2">Net Tax Payable</td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partIV.net.cgst)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partIV.net.sgst)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(data.partIV.net.total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Monthly Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">
                  Monthly Breakdown
                </h2>
              </div>
              <div className="p-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-3 py-2 font-medium text-gray-600">
                        Month
                      </th>
                      <th className="px-3 py-2 font-medium text-gray-600 text-right">
                        Sales Value
                      </th>
                      <th className="px-3 py-2 font-medium text-gray-600 text-right">
                        Sales Tax
                      </th>
                      <th className="px-3 py-2 font-medium text-gray-600 text-right">
                        Purchase Value
                      </th>
                      <th className="px-3 py-2 font-medium text-gray-600 text-right">
                        Purchase Tax
                      </th>
                      <th className="px-3 py-2 font-medium text-gray-600 text-right">
                        Net Tax
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthly.map((row, i) => (
                      <tr
                        key={i}
                        className={`${
                          i % 2 === 1 ? "bg-gray-50/50" : ""
                        } hover:bg-gray-50`}
                      >
                        <td className="px-3 py-2 font-medium">{row.month}</td>
                        <td className="px-3 py-2 text-right">
                          {formatINR(row.salesValue)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatINR(row.salesTax)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatINR(row.purchaseValue)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatINR(row.purchaseTax)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-medium ${
                            row.netTax >= 0
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          {formatINR(row.netTax)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold">
                      <td className="px-3 py-2">Total</td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(
                          data.monthly.reduce((s, r) => s + r.salesValue, 0)
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(
                          data.monthly.reduce((s, r) => s + r.salesTax, 0)
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(
                          data.monthly.reduce(
                            (s, r) => s + r.purchaseValue,
                            0
                          )
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(
                          data.monthly.reduce(
                            (s, r) => s + r.purchaseTax,
                            0
                          )
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(
                          data.monthly.reduce((s, r) => s + r.netTax, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
