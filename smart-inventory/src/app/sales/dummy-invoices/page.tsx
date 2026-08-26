"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import {
  Loader2,
  Plus,
  Search,
  X,
  Eye,
  MoreVertical,
  FileText,
  Clock,
  CheckCircle2,
} from "lucide-react";

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

const STATUS_FILTERS = ["ALL", "PENDING", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"];

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
  const pagination = data?.pagination || { totalPages: 1, total: 0 };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const fmtDate = (s: string | null) => {
    if (!s) return "—";
    return new Date(s).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const totalCount: number = pagination.total || 0;
  const pendingCount = invoices.filter((inv) => inv.effectiveStatus === "PENDING").length;
  const paidCount = invoices.filter((inv) => inv.effectiveStatus === "PAID").length;

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Dummy Invoices</h1>
          <p className="text-gray-600">Direct invoices created without a sales order</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Paid</p>
                <p className="text-2xl font-bold text-gray-900">{paidCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          {/* Status Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((s) => (
              <Button
                key={s}
                variant={status === s ? "default" : "outline"}
                size="sm"
                onClick={() => { setStatus(s); setPage(1); }}
                className={status === s ? "bg-teal-500 hover:bg-teal-600" : ""}
              >
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </Button>
            ))}
          </div>

          {/* Search + New Button */}
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by invoice #, customer..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 pr-8"
              />
              {search && (
                <button
                  onClick={() => { setSearch(""); setPage(1); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              onClick={() => router.push("/sales/dummy-invoices/new")}
              className="bg-teal-500 hover:bg-teal-600 text-white flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New Dummy Invoice
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
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
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold text-center w-[60px]">S.No.</TableHead>
                    <TableHead className="font-semibold">Invoice Date</TableHead>
                    <TableHead className="font-semibold">Invoice #</TableHead>
                    <TableHead className="font-semibold">Customer</TableHead>
                    <TableHead className="font-semibold">Due Date</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold text-right">Amount</TableHead>
                    <TableHead className="font-semibold text-right">Balance</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv, rowIndex) => (
                    <TableRow key={inv.id} className="hover:bg-gray-50">
                      <TableCell className="text-center text-gray-500">{rowIndex + 1}</TableCell>
                      <TableCell className="text-gray-600">{fmtDate(inv.invoiceDate)}</TableCell>
                      <TableCell className="font-medium text-gray-900">{inv.invoiceNumber}</TableCell>
                      <TableCell>
                        <p className="font-medium text-gray-800">{inv.customer.name}</p>
                        <p className="text-xs text-gray-500">{inv.customer.customerNumber}</p>
                      </TableCell>
                      <TableCell className="text-gray-600">{fmtDate(inv.dueDate)}</TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={inv.effectiveStatus} />
                      </TableCell>
                      <TableCell className="text-right text-gray-700">
                        {formatCurrency(Number(inv.totalAmount))}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          Number(inv.balanceAmount) > 0 ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {formatCurrency(Number(inv.balanceAmount))}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => router.push(`/sales/dummy-invoices/${inv.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between px-4 pb-4">
                  <p className="text-sm text-gray-600">
                    Showing {(page - 1) * 20 + 1} to{" "}
                    {Math.min(page * 20, totalCount)} of {totalCount}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={page === pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
