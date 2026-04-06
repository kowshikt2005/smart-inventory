"use client";

import React, { Suspense } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, ExternalLink } from "lucide-react";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { exportToExcel, exportToPDF, fmtNum, fmtDateExport, fetchCompanySettings } from "@/lib/export-utils";

interface Invoice {
  id: string;
  number: string;
  date: string;
  vendorName: string;
  vendorId: string;
  amount: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  taxableAmount: number;
  taxAmount: number;
  roundOff: number;
}

interface Payment {
  id: string;
  number: string;
  date: string;
  vendorName: string;
  vendorId: string;
  amount: number;
  mode: string;
  reference: string | null;
}

interface Return {
  id: string;
  number: string;
  date: string;
  vendorName: string;
  vendorId: string;
  amount: number;
  status: string;
}

interface DetailData {
  invoices: Invoice[];
  payments: Payment[];
  returns: Return[];
  summary: {
    totalInvoices: number;
    totalPayments: number;
    totalReturns: number;
    credit: number;
    debit: number;
    balance: number;
  };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function PurchaseRegisterDetailsPage() {
  return (
    <Suspense fallback={<DashboardLayout><div className="p-6 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-teal-500" /></div></DashboardLayout>}>
      <PurchaseRegisterDetailsContent />
    </Suspense>
  );
}

function PurchaseRegisterDetailsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const vendorId = searchParams.get("vendorId") || "all";

  const [data, setData] = useState<DetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const monthName = month ? MONTH_NAMES[parseInt(month)] : "";

  useEffect(() => {
    const fetchData = async () => {
      if (!month || !year) return;

      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.append("month", month);
        params.append("year", year);
        if (vendorId !== "all") params.append("vendorId", vendorId);

        const response = await fetch(`/api/reports/purchase-register/details?${params}`);
        if (response.ok) {
          const detailData = await response.json();
          setData(detailData);
        }
      } catch (err) {
        console.error("Error fetching details:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [month, year, vendorId]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const fmtDate = (s: string) => {
    if (!s) return "";
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  };

  const handleExportExcel = async () => {
    if (!data) return;
    const { company } = await fetchCompanySettings();
    const sheets = [];
    if (data.invoices.length > 0) {
      sheets.push({
        name: "Invoices",
        headers: ["Date", "Trans No", "Contact", "Taxable Amt", "Tax Amt", "RoundOff", "Total Amt", "Status"],
        rows: data.invoices.map((inv) => [fmtDateExport(inv.date), inv.number, inv.vendorName, inv.taxableAmount, inv.taxAmount, inv.roundOff, inv.amount, inv.status]),
      });
    }
    if (data.payments.length > 0) {
      sheets.push({
        name: "Vendor Payments",
        headers: ["Date", "Payment No", "Vendor", "Mode", "Reference", "Amount"],
        rows: data.payments.map((p) => [fmtDateExport(p.date), p.number, p.vendorName, p.mode, p.reference || "-", p.amount]),
      });
    }
    if (data.returns.length > 0) {
      sheets.push({
        name: "Returns",
        headers: ["Date", "Return No", "Vendor", "Amount", "Status"],
        rows: data.returns.map((r) => [fmtDateExport(r.date), r.number, r.vendorName, r.amount, r.status]),
      });
    }
    if (sheets.length > 0) {
      exportToExcel({ fileName: `Purchase-Register-Details_${monthName}-${year}.xlsx`, sheets, company });
    }
  };

  const handleExportPDF = async () => {
    if (!data) return;
    const { company } = await fetchCompanySettings();
    const sheets = [];
    if (data.invoices.length > 0) {
      sheets.push({
        name: "Invoices",
        headers: ["Date", "Trans No", "Contact", "Taxable Amt", "Tax Amt", "RoundOff", "Total Amt", "Status"],
        rows: data.invoices.map((inv) => [fmtDateExport(inv.date), inv.number, inv.vendorName, fmtNum(inv.taxableAmount), fmtNum(inv.taxAmount), fmtNum(inv.roundOff), fmtNum(inv.amount), inv.status]),
      });
    }
    if (data.payments.length > 0) {
      sheets.push({
        name: "Vendor Payments",
        headers: ["Date", "Payment No", "Vendor", "Mode", "Reference", "Amount"],
        rows: data.payments.map((p) => [fmtDateExport(p.date), p.number, p.vendorName, p.mode, p.reference || "-", fmtNum(p.amount)]),
      });
    }
    if (data.returns.length > 0) {
      sheets.push({
        name: "Returns",
        headers: ["Date", "Return No", "Vendor", "Amount", "Status"],
        rows: data.returns.map((r) => [fmtDateExport(r.date), r.number, r.vendorName, fmtNum(r.amount), r.status]),
      });
    }
    if (sheets.length > 0) {
      exportToPDF({ fileName: `Purchase-Register-Details_${monthName}-${year}.pdf`, title: "Purchase Register - Detailed View", subtitle: `${monthName} ${year}`, sheets, company });
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Purchase Register</h1>
            <p className="text-sm text-gray-500">
              {monthName} {year} - Detailed View
            </p>
          </div>
          <ExportButtons onExportPDF={handleExportPDF} onExportExcel={handleExportExcel} disabled={!data} />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
            <span className="ml-2 text-gray-500">Loading details...</span>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white border rounded-lg p-4">
                <p className="text-sm text-gray-500">Total Invoices</p>
                <p className="text-xl font-bold text-gray-900">{data.invoices.length}</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-600">Credit (Purchases)</p>
                <p className="text-xl font-bold text-green-700">₹{fmt(data.summary.credit)}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600">Debit (Payments + Returns)</p>
                <p className="text-xl font-bold text-red-700">₹{fmt(data.summary.debit)}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-600">Net Balance</p>
                <p className="text-xl font-bold text-blue-700">
                  ₹{fmt(Math.abs(data.summary.balance))} {data.summary.balance >= 0 ? "Cr" : "Dr"}
                </p>
              </div>
            </div>

            {/* Invoices Table */}
            {data.invoices.length > 0 && (
              <div className="bg-white border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-3 border-b">
                  <h2 className="font-semibold text-gray-800">Purchase Invoices</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-600 uppercase">
                        <th className="text-left px-4 py-3 font-semibold">Date</th>
                        <th className="text-left px-4 py-3 font-semibold">Trans No</th>
                        <th className="text-left px-4 py-3 font-semibold">Contact</th>
                        <th className="text-right px-4 py-3 font-semibold">Taxable Amt (₹)</th>
                        <th className="text-right px-4 py-3 font-semibold">Tax Amt (₹)</th>
                        <th className="text-right px-4 py-3 font-semibold">RoundOff</th>
                        <th className="text-right px-4 py-3 font-semibold">Total Amt (₹)</th>
                        <th className="text-center px-4 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.invoices.map((inv) => (
                        <tr
                          key={inv.id}
                          className="border-t hover:bg-blue-50 cursor-pointer"
                          onClick={() => router.push(`/purchases/invoices/${inv.id}`)}
                        >
                          <td className="px-4 py-3 text-sm">{fmtDate(inv.date)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-teal-600 font-medium hover:underline">{inv.number}</span>
                              <ExternalLink className="h-3 w-3 text-gray-400" />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">{inv.vendorName}</td>
                          <td className="px-4 py-3 text-sm text-right">{fmt(inv.taxableAmount)}</td>
                          <td className="px-4 py-3 text-sm text-right">{fmt(inv.taxAmount)}</td>
                          <td className="px-4 py-3 text-sm text-right">{fmt(inv.roundOff)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-semibold text-blue-600">{fmt(inv.amount)}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              inv.status === "PAID" ? "bg-green-100 text-green-700" :
                              inv.status === "PARTIAL" ? "bg-blue-100 text-blue-700" :
                              "bg-yellow-100 text-yellow-700"
                            }`}>{inv.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100 font-semibold">
                        <td colSpan={3} className="px-4 py-3">Total</td>
                        <td className="px-4 py-3 text-right">
                          {fmt(data.invoices.reduce((sum, inv) => sum + inv.taxableAmount, 0))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {fmt(data.invoices.reduce((sum, inv) => sum + inv.taxAmount, 0))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {fmt(data.invoices.reduce((sum, inv) => sum + inv.roundOff, 0))}
                        </td>
                        <td className="px-4 py-3 text-right text-blue-600">
                          {fmt(data.invoices.reduce((sum, inv) => sum + inv.amount, 0))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Payments Table */}
            {data.payments.length > 0 && (
              <div className="bg-white border rounded-lg overflow-hidden">
                <div className="bg-blue-100 px-4 py-3 border-b">
                  <h2 className="font-semibold text-blue-800">Vendor Payments</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-600 uppercase">
                        <th className="text-left px-4 py-3 font-semibold">Date</th>
                        <th className="text-left px-4 py-3 font-semibold">Payment No</th>
                        <th className="text-left px-4 py-3 font-semibold">Vendor</th>
                        <th className="text-left px-4 py-3 font-semibold">Mode</th>
                        <th className="text-left px-4 py-3 font-semibold">Reference</th>
                        <th className="text-right px-4 py-3 font-semibold">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payments.map((pay) => (
                        <tr
                          key={pay.id}
                          className="border-t hover:bg-blue-50 cursor-pointer"
                          onClick={() => router.push(`/purchases/vendor-payments/${pay.id}`)}
                        >
                          <td className="px-4 py-3 text-sm">{fmtDate(pay.date)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-teal-600 font-medium hover:underline">{pay.number}</span>
                              <ExternalLink className="h-3 w-3 text-gray-400" />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">{pay.vendorName}</td>
                          <td className="px-4 py-3 text-sm">{pay.mode}</td>
                          <td className="px-4 py-3 text-sm">{pay.reference || "-"}</td>
                          <td className="px-4 py-3 text-right font-semibold text-blue-600">{fmt(pay.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100 font-semibold">
                        <td colSpan={5} className="px-4 py-3">Total</td>
                        <td className="px-4 py-3 text-right text-blue-600">
                          {fmt(data.payments.reduce((sum, pay) => sum + pay.amount, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Returns Table */}
            {data.returns.length > 0 && (
              <div className="bg-white border rounded-lg overflow-hidden">
                <div className="bg-orange-100 px-4 py-3 border-b">
                  <h2 className="font-semibold text-orange-800">Purchase Returns</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-600 uppercase">
                        <th className="text-left px-4 py-3 font-semibold">Date</th>
                        <th className="text-left px-4 py-3 font-semibold">Return No</th>
                        <th className="text-left px-4 py-3 font-semibold">Vendor</th>
                        <th className="text-right px-4 py-3 font-semibold">Amount (₹)</th>
                        <th className="text-center px-4 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.returns.map((ret) => (
                        <tr
                          key={ret.id}
                          className="border-t hover:bg-blue-50 cursor-pointer"
                          onClick={() => router.push(`/purchases/returns/${ret.id}`)}
                        >
                          <td className="px-4 py-3 text-sm">{fmtDate(ret.date)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-teal-600 font-medium hover:underline">{ret.number}</span>
                              <ExternalLink className="h-3 w-3 text-gray-400" />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">{ret.vendorName}</td>
                          <td className="px-4 py-3 text-right font-semibold text-orange-600">{fmt(ret.amount)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">{ret.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100 font-semibold">
                        <td colSpan={3} className="px-4 py-3">Total</td>
                        <td className="px-4 py-3 text-right text-orange-600">
                          {fmt(data.returns.reduce((sum, ret) => sum + ret.amount, 0))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {data.invoices.length === 0 && data.payments.length === 0 && data.returns.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No transactions found for this month
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            No data available
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
