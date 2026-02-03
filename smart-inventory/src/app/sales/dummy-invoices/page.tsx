"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { Loader2, Plus, Search } from "lucide-react";

interface Customer {
  id: string;
  customerNumber: string;
  name: string;
}

interface DummyInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  totalAmount: number;
  balanceAmount: number;
  paymentStatus: string;
  effectiveStatus: string;
  customer: Customer;
}

const STATUS_TABS = ["ALL", "PENDING", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"];

export default function DummyInvoicesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  params.set("page", String(page));
  if (search) params.set("search", search);
  if (status !== "ALL") params.set("status", status);

  const { data, isLoading } = useSWR(`/api/dummy-invoices?${params.toString()}`);

  const invoices: DummyInvoice[] = data?.invoices || [];
  const pagination = data?.pagination || { totalPages: 1 };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const fmtDate = (s: string | null) => {
    if (!s) return "—";
    return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dummy Invoices</h1>
            <p className="text-sm text-gray-500">Direct invoices created without a sales order</p>
          </div>
          <Button
            onClick={() => router.push("/sales/dummy-invoices/new")}
            className="bg-teal-500 hover:bg-teal-600 text-white flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Dummy Invoice
          </Button>
        </div>

        {/* Search + Status Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by invoice #, customer..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {STATUS_TABS.map((s) => (
              <button
                key={s}
                onClick={() => { setStatus(s); setPage(1); }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  status === s
                    ? "bg-teal-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading…</span>
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <p className="text-lg font-medium">No dummy invoices found</p>
              <p className="text-sm mt-1">Create one using the button above</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Invoice Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Invoice #</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Customer</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Due Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Balance</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/sales/dummy-invoices/${inv.id}`)}
                    >
                      <td className="px-4 py-3 text-gray-600">{fmtDate(inv.invoiceDate)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{inv.customer.name}</p>
                        <p className="text-xs text-gray-500">{inv.customer.customerNumber}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{fmtDate(inv.dueDate)}</td>
                      <td className="px-4 py-3">
                        <InvoiceStatusBadge status={inv.effectiveStatus} />
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">₹{fmt(Number(inv.totalAmount))}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${Number(inv.balanceAmount) > 0 ? "text-red-600" : "text-green-600"}`}>
                        ₹{fmt(Number(inv.balanceAmount))}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/sales/dummy-invoices/${inv.id}`); }}
                          className="text-teal-600 hover:underline text-xs"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 py-3 border-t border-gray-200">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border rounded-md disabled:opacity-40 hover:bg-gray-100"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={page === pagination.totalPages}
                    className="px-3 py-1 text-sm border rounded-md disabled:opacity-40 hover:bg-gray-100"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
