"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  GSTMonthYearSelector,
  getDefaultMonthly,
} from "@/components/reports/GSTMonthYearSelector";
import { formatINR } from "@/lib/gst-report-utils";
import { Calculator, Loader2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { exportToExcel, exportToPDF, fmtNum, monthLabel } from "@/lib/export-utils";

interface GSTR3BData {
  period: { month: string; year: number };
  outwardSupplies: {
    taxableValue: number;
    cgst: number;
    sgst: number;
    rateWise: Array<{
      rate: number;
      taxableValue: number;
      cgst: number;
      sgst: number;
    }>;
  };
  inputTaxCredit: {
    available: { taxableValue: number; cgst: number; sgst: number };
    reversed: { taxableValue: number; cgst: number; sgst: number };
    net: { cgst: number; sgst: number };
  };
  taxPayable: {
    output: { cgst: number; sgst: number };
    input: { cgst: number; sgst: number };
    net: { cgst: number; sgst: number; total: number };
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
        const res = await fetch(
          `/api/reports/gstr-3b?month=${period.month}&year=${period.year}`
        );
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

  const handleExportExcel = () => {
    if (!data) return;
    const sheets = [
      { name: "Outward Supplies", headers: ["Description", "Taxable Value", "CGST", "SGST"], rows: [["Outward taxable supplies", data.outwardSupplies.taxableValue, data.outwardSupplies.cgst, data.outwardSupplies.sgst], ...data.outwardSupplies.rateWise.map((r) => [`Rate ${r.rate}%`, r.taxableValue, r.cgst, r.sgst])] },
      { name: "Eligible ITC", headers: ["Details", "CGST", "SGST"], rows: [["ITC Available", data.inputTaxCredit.available.cgst, data.inputTaxCredit.available.sgst], ["ITC Reversed", data.inputTaxCredit.reversed.cgst, data.inputTaxCredit.reversed.sgst], ["Net ITC", data.inputTaxCredit.net.cgst, data.inputTaxCredit.net.sgst]] },
      { name: "Tax Payable", headers: ["Description", "CGST", "SGST", "Total"], rows: [["Output Tax", data.taxPayable.output.cgst, data.taxPayable.output.sgst, data.taxPayable.output.cgst + data.taxPayable.output.sgst], ["Less: ITC", data.taxPayable.input.cgst, data.taxPayable.input.sgst, data.taxPayable.input.cgst + data.taxPayable.input.sgst], ["Net Tax Payable", data.taxPayable.net.cgst, data.taxPayable.net.sgst, data.taxPayable.net.total]] },
    ];
    exportToExcel({ fileName: `GSTR-3B_${monthLabel(period.month - 1, period.year)}.xlsx`, sheets });
  };

  const handleExportPDF = () => {
    if (!data) return;
    const sheets = [
      { name: "3.1 — Outward Supplies", headers: ["Description", "Taxable Value", "CGST", "SGST"], rows: [["Outward taxable supplies", fmtNum(data.outwardSupplies.taxableValue), fmtNum(data.outwardSupplies.cgst), fmtNum(data.outwardSupplies.sgst)], ...data.outwardSupplies.rateWise.map((r) => [`Rate ${r.rate}%`, fmtNum(r.taxableValue), fmtNum(r.cgst), fmtNum(r.sgst)])] },
      { name: "4 — Eligible ITC", headers: ["Details", "CGST", "SGST"], rows: [["ITC Available", fmtNum(data.inputTaxCredit.available.cgst), fmtNum(data.inputTaxCredit.available.sgst)], ["ITC Reversed", fmtNum(data.inputTaxCredit.reversed.cgst), fmtNum(data.inputTaxCredit.reversed.sgst)], ["Net ITC", fmtNum(data.inputTaxCredit.net.cgst), fmtNum(data.inputTaxCredit.net.sgst)]] },
      { name: "5 — Tax Payable", headers: ["Description", "CGST", "SGST", "Total"], rows: [["Output Tax", fmtNum(data.taxPayable.output.cgst), fmtNum(data.taxPayable.output.sgst), fmtNum(data.taxPayable.output.cgst + data.taxPayable.output.sgst)], ["Less: ITC", fmtNum(data.taxPayable.input.cgst), fmtNum(data.taxPayable.input.sgst), fmtNum(data.taxPayable.input.cgst + data.taxPayable.input.sgst)], ["Net Tax Payable", fmtNum(data.taxPayable.net.cgst), fmtNum(data.taxPayable.net.sgst), fmtNum(data.taxPayable.net.total)]] },
    ];
    exportToPDF({ fileName: `GSTR-3B_${monthLabel(period.month - 1, period.year)}.pdf`, title: "GSTR-3B — Monthly Summary Return", subtitle: monthLabel(period.month - 1, period.year), sheets });
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
              <p className="text-sm text-gray-500">
                Monthly Summary Return
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
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-500 gap-2">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Card 1: 3.1 — Outward Supplies */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">
                  3.1 — Outward Supplies
                </h2>
              </div>
              <div className="p-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-3 py-2 font-medium text-gray-600">
                        Description
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
                  <tbody>
                    <tr className="font-medium">
                      <td className="px-3 py-3">
                        Outward taxable supplies (other than zero rated, nil
                        rated and exempted)
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatINR(data.outwardSupplies.taxableValue)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatINR(data.outwardSupplies.cgst)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatINR(data.outwardSupplies.sgst)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {data.outwardSupplies.rateWise.length > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={() => setShowRateWise(!showRateWise)}
                      className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium"
                    >
                      {showRateWise ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      Rate-wise breakdown
                    </button>
                    {showRateWise && (
                      <table className="w-full text-sm mt-2">
                        <thead>
                          <tr className="bg-orange-50 text-left">
                            <th className="px-3 py-2 font-medium text-orange-700">
                              Rate %
                            </th>
                            <th className="px-3 py-2 font-medium text-orange-700 text-right">
                              Taxable Value
                            </th>
                            <th className="px-3 py-2 font-medium text-orange-700 text-right">
                              CGST
                            </th>
                            <th className="px-3 py-2 font-medium text-orange-700 text-right">
                              SGST
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-orange-100">
                          {data.outwardSupplies.rateWise.map((r, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2">{r.rate}%</td>
                              <td className="px-3 py-2 text-right">
                                {formatINR(r.taxableValue)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {formatINR(r.cgst)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {formatINR(r.sgst)}
                              </td>
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
                <h2 className="text-base font-semibold text-gray-900">
                  4 — Eligible ITC
                </h2>
              </div>
              <div className="p-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-3 py-2 font-medium text-gray-600">
                        Details
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
                      <td className="px-3 py-3">
                        ITC Available (All other ITC)
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatINR(data.inputTaxCredit.available.cgst)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatINR(data.inputTaxCredit.available.sgst)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-3 text-red-600">
                        ITC Reversed (Purchase Returns)
                      </td>
                      <td className="px-3 py-3 text-right text-red-600">
                        {formatINR(data.inputTaxCredit.reversed.cgst)}
                      </td>
                      <td className="px-3 py-3 text-right text-red-600">
                        {formatINR(data.inputTaxCredit.reversed.sgst)}
                      </td>
                    </tr>
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-3 py-3">Net ITC</td>
                      <td className="px-3 py-3 text-right">
                        {formatINR(data.inputTaxCredit.net.cgst)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatINR(data.inputTaxCredit.net.sgst)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Card 3: 5 — Tax Payable */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">
                  5 — Tax Payable
                </h2>
              </div>
              <div className="p-6">
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
                      <td className="px-3 py-3">Output Tax Liability</td>
                      <td className="px-3 py-3 text-right">
                        {formatINR(data.taxPayable.output.cgst)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatINR(data.taxPayable.output.sgst)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatINR(
                          data.taxPayable.output.cgst +
                            data.taxPayable.output.sgst
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-3 text-green-700">
                        Less: Input Tax Credit
                      </td>
                      <td className="px-3 py-3 text-right text-green-700">
                        {formatINR(data.taxPayable.input.cgst)}
                      </td>
                      <td className="px-3 py-3 text-right text-green-700">
                        {formatINR(data.taxPayable.input.sgst)}
                      </td>
                      <td className="px-3 py-3 text-right text-green-700">
                        {formatINR(
                          data.taxPayable.input.cgst +
                            data.taxPayable.input.sgst
                        )}
                      </td>
                    </tr>
                    <tr className="bg-teal-50 font-bold text-teal-800">
                      <td className="px-3 py-3">Net Tax Payable</td>
                      <td className="px-3 py-3 text-right">
                        {formatINR(data.taxPayable.net.cgst)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatINR(data.taxPayable.net.sgst)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatINR(data.taxPayable.net.total)}
                      </td>
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
