"use client";

import React from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  X,
  Calendar,
  ExternalLink,
  Eye,
  ChevronRight,
} from "lucide-react";

interface OrderItem {
  id: string;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface CustomerInfo {
  id: string;
  customerNumber: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  gstin: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  orderDate: string;
  expectedDelivery: string | null;
  status: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  invoicedAmount: number;
  pendingAmount: number;
  notes: string | null;
  referenceNumber: string | null;
  customer: CustomerInfo;
  itemCount: number;
  invoiceCount: number;
  items: OrderItem[];
}

interface Summary {
  totalOrders: number;
  totalCustomers: number;
  totalAmount: number;
  totalInvoiced: number;
  totalPending: number;
}

export default function BilledUnbilledReportPage() {
  const router = useRouter();
  const [type, setType] = useState<"unbilled" | "billed">("unbilled");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // API query
  const queryString = useMemo(() => {
    const params: string[] = [`type=${type}`];
    if (fromDate) params.push(`fromDate=${fromDate}`);
    if (toDate) params.push(`toDate=${toDate}`);
    return params.join("&");
  }, [type, fromDate, toDate]);

  const { data, isLoading } = useSWR(
    `/api/reports/billed-unbilled?${queryString}`
  );

  const orders: Order[] = data?.orders || [];
  const summary: Summary = data?.summary || {
    totalOrders: 0,
    totalCustomers: 0,
    totalAmount: 0,
    totalInvoiced: 0,
    totalPending: 0,
  };

  // Helpers
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const fmtDate = (s: string) => {
    if (!s) return "-";
    const [y, m, d] = s.split("-");
    return `${d}-${m}-${y}`;
  };

  const clearDateFilters = () => {
    setFromDate("");
    setToDate("");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return { label: "Open", class: "bg-blue-100 text-blue-700" };
      case "HOLD":
        return { label: "Hold", class: "bg-amber-100 text-amber-700" };
      case "PARTIALLY_INVOICED":
        return { label: "Partially Invoiced", class: "bg-orange-100 text-orange-700" };
      case "FULLY_INVOICED":
        return { label: "Fully Invoiced", class: "bg-green-100 text-green-700" };
      case "REJECTED":
        return { label: "Rejected", class: "bg-red-100 text-red-700" };
      default:
        return { label: status, class: "bg-gray-100 text-gray-700" };
    }
  };

  const toggleExpand = (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Billed & Unbilled Report
          </h1>
          <p className="text-sm text-gray-500">
            Track sales orders that are billed (invoiced) or pending billing
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Total Orders</p>
            <p className="text-2xl font-bold text-gray-900">
              {summary.totalOrders}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Customers</p>
            <p className="text-2xl font-bold text-blue-600">
              {summary.totalCustomers}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Total Order Value (₹)</p>
            <p className="text-2xl font-bold text-teal-600">
              ₹{fmt(summary.totalAmount)}
            </p>
          </div>
          {type === "billed" ? (
            <div className="bg-green-50 rounded-lg border border-green-200 shadow-sm p-4 text-center">
              <p className="text-sm text-green-600 mb-1">Invoiced (₹)</p>
              <p className="text-2xl font-bold text-green-700">
                ₹{fmt(summary.totalInvoiced)}
              </p>
            </div>
          ) : (
            <div className="bg-red-50 rounded-lg border border-red-200 shadow-sm p-4 text-center">
              <p className="text-sm text-red-600 mb-1">Pending Billing (₹)</p>
              <p className="text-2xl font-bold text-red-700">
                ₹{fmt(summary.totalPending)}
              </p>
            </div>
          )}
        </div>

        {/* Toggle + Filters */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
          {/* Billed / Unbilled Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => { setType("unbilled"); setExpandedOrder(null); }}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                type === "unbilled"
                  ? "bg-red-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Unbilled
            </button>
            <button
              onClick={() => { setType("billed"); setExpandedOrder(null); }}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                type === "billed"
                  ? "bg-green-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Billed
            </button>
          </div>

          {/* Date filters */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-40"
            />
            <span className="text-gray-400">to</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-40"
            />
            {(fromDate || toDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearDateFilters}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading report...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <p className="text-lg font-medium">
                No {type === "unbilled" ? "unbilled" : "billed"} orders found
              </p>
              <p className="text-sm mt-1">
                {type === "unbilled"
                  ? "All sales orders have been invoiced"
                  : "No sales orders have been invoiced yet"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-100">
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="font-semibold text-gray-700">Order No</TableHead>
                    <TableHead className="font-semibold text-gray-700">Order Date</TableHead>
                    <TableHead className="font-semibold text-gray-700">Customer</TableHead>
                    <TableHead className="font-semibold text-gray-700">Items</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">
                      Order Amt (₹)
                    </TableHead>
                    {type === "billed" && (
                      <>
                        <TableHead className="font-semibold text-gray-700 text-right">
                          Invoiced (₹)
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700 text-right">
                          Pending (₹)
                        </TableHead>
                      </>
                    )}
                    <TableHead className="font-semibold text-gray-700 text-center">
                      Status
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 text-center">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {orders.map((order) => {
                    const statusInfo = getStatusBadge(order.status);
                    const isExpanded = expandedOrder === order.id;

                    return (
                      <React.Fragment key={order.id}>
                        <TableRow
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => toggleExpand(order.id)}
                        >
                          <TableCell className="w-8 px-2">
                            <ChevronRight
                              className={`h-4 w-4 text-gray-400 transition-transform ${
                                isExpanded ? "rotate-90" : ""
                              }`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span
                                className="text-teal-600 font-medium hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/sales/orders/${order.id}`);
                                }}
                              >
                                {order.orderNumber}
                              </span>
                              <ExternalLink className="h-3 w-3 text-gray-400" />
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {fmtDate(order.orderDate)}
                          </TableCell>
                          <TableCell className="font-medium text-gray-800">
                            {order.customer.name}
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {order.itemCount} item{order.itemCount !== 1 ? "s" : ""}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-gray-900">
                            {fmt(order.totalAmount)}
                          </TableCell>
                          {type === "billed" && (
                            <>
                              <TableCell className="text-right text-green-600 font-medium">
                                {fmt(order.invoicedAmount)}
                              </TableCell>
                              <TableCell className="text-right text-red-600 font-medium">
                                {fmt(order.pendingAmount)}
                              </TableCell>
                            </>
                          )}
                          <TableCell className="text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusInfo.class}`}
                            >
                              {statusInfo.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/sales/orders/${order.id}`);
                              }}
                            >
                              <Eye className="h-4 w-4 text-gray-500" />
                            </Button>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Detail Row */}
                        {isExpanded && (
                          <TableRow className="bg-gray-50">
                            <TableCell
                              colSpan={type === "billed" ? 10 : 8}
                              className="p-0"
                            >
                              <div className="px-8 py-4">
                                {/* Customer Details */}
                                <div className="grid grid-cols-2 gap-6 mb-4">
                                  <div className="bg-white rounded-lg border p-4">
                                    <h4 className="font-semibold text-gray-700 mb-2 text-sm">
                                      Customer Details
                                    </h4>
                                    <div className="space-y-1 text-sm">
                                      <p>
                                        <span className="text-gray-500">Name:</span>{" "}
                                        {order.customer.name}
                                      </p>
                                      <p>
                                        <span className="text-gray-500">Customer #:</span>{" "}
                                        {order.customer.customerNumber}
                                      </p>
                                      {order.customer.gstin && (
                                        <p>
                                          <span className="text-gray-500">GSTIN:</span>{" "}
                                          {order.customer.gstin}
                                        </p>
                                      )}
                                      {order.customer.phone && (
                                        <p>
                                          <span className="text-gray-500">Phone:</span>{" "}
                                          {order.customer.phone}
                                        </p>
                                      )}
                                      {order.customer.email && (
                                        <p>
                                          <span className="text-gray-500">Email:</span>{" "}
                                          {order.customer.email}
                                        </p>
                                      )}
                                      {(order.customer.city || order.customer.state) && (
                                        <p>
                                          <span className="text-gray-500">Location:</span>{" "}
                                          {[order.customer.city, order.customer.state]
                                            .filter(Boolean)
                                            .join(", ")}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="bg-white rounded-lg border p-4">
                                    <h4 className="font-semibold text-gray-700 mb-2 text-sm">
                                      Order Details
                                    </h4>
                                    <div className="space-y-1 text-sm">
                                      <p>
                                        <span className="text-gray-500">Order Date:</span>{" "}
                                        {fmtDate(order.orderDate)}
                                      </p>
                                      {order.expectedDelivery && (
                                        <p>
                                          <span className="text-gray-500">
                                            Expected Delivery:
                                          </span>{" "}
                                          {fmtDate(order.expectedDelivery)}
                                        </p>
                                      )}
                                      {order.referenceNumber && (
                                        <p>
                                          <span className="text-gray-500">Reference:</span>{" "}
                                          {order.referenceNumber}
                                        </p>
                                      )}
                                      <p>
                                        <span className="text-gray-500">Invoices:</span>{" "}
                                        {order.invoiceCount}
                                      </p>
                                      {order.notes && (
                                        <p>
                                          <span className="text-gray-500">Notes:</span>{" "}
                                          {order.notes}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Items Table */}
                                <div className="bg-white rounded-lg border overflow-hidden mb-3">
                                  <table className="w-full">
                                    <thead>
                                      <tr className="bg-gray-100 text-xs text-gray-600 uppercase">
                                        <th className="text-left px-4 py-2 font-semibold">
                                          Item
                                        </th>
                                        <th className="text-left px-4 py-2 font-semibold">
                                          Code
                                        </th>
                                        <th className="text-right px-4 py-2 font-semibold">
                                          Qty
                                        </th>
                                        <th className="text-right px-4 py-2 font-semibold">
                                          Rate (₹)
                                        </th>
                                        <th className="text-right px-4 py-2 font-semibold">
                                          Amount (₹)
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {order.items.map((item) => (
                                        <tr
                                          key={item.id}
                                          className="border-t text-sm"
                                        >
                                          <td className="px-4 py-2 font-medium">
                                            {item.itemName}
                                          </td>
                                          <td className="px-4 py-2 text-gray-500">
                                            {item.itemCode}
                                          </td>
                                          <td className="px-4 py-2 text-right">
                                            {item.quantity} {item.unit}
                                          </td>
                                          <td className="px-4 py-2 text-right">
                                            {fmt(item.rate)}
                                          </td>
                                          <td className="px-4 py-2 text-right font-medium">
                                            {fmt(item.amount)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="bg-gray-50 font-semibold border-t">
                                        <td colSpan={4} className="px-4 py-2 text-right">
                                          Total
                                        </td>
                                        <td className="px-4 py-2 text-right text-blue-600">
                                          {fmt(order.totalAmount)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>

                                {/* Go to Order Button */}
                                <div className="flex justify-end">
                                  <Button
                                    className="bg-teal-600 hover:bg-teal-700"
                                    size="sm"
                                    onClick={() =>
                                      router.push(`/sales/orders/${order.id}`)
                                    }
                                  >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    View Sales Order
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Total Row */}
              <div className="border-t-2 border-gray-300 bg-gray-50">
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="w-8"></TableCell>
                      <TableCell className="font-bold text-gray-900">
                        Total
                      </TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell />
                      <TableCell className="text-right font-bold text-gray-900">
                        {fmt(orders.reduce((sum, o) => sum + o.totalAmount, 0))}
                      </TableCell>
                      {type === "billed" && (
                        <>
                          <TableCell className="text-right font-bold text-green-600">
                            {fmt(
                              orders.reduce(
                                (sum, o) => sum + o.invoicedAmount,
                                0
                              )
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold text-red-600">
                            {fmt(
                              orders.reduce(
                                (sum, o) => sum + o.pendingAmount,
                                0
                              )
                            )}
                          </TableCell>
                        </>
                      )}
                      <TableCell />
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
