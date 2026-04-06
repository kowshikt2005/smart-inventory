"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { PurchaseReturnStatusBadge } from "@/components/purchase-orders/PurchaseOrderStatusBadge";
import {
  ArrowLeft,
  Loader2,
  Edit,
  Trash2,
  CheckCircle,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import useSWR from "swr";

interface Vendor {
  id: string;
  vendorNumber: string;
  name: string;
  gstin: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

interface Item {
  id: string;
  itemCode: string;
  name: string;
  unit: string;
  hsnCode: string | null;
  gstRate: number;
  purchasePrice: number;
}

interface ReturnItem {
  id: string;
  itemId: string;
  quantity: number;
  rate: number;
  taxRate: number;
  taxAmount: number;
  amount: number;
  item: Item;
}

interface PurchaseInvoiceRef {
  id: string;
  invoiceNumber: string;
  date: string;
  totalAmount: number;
  status: string;
}

interface PurchaseReturn {
  id: string;
  returnNumber: string;
  date: string;
  vendorId: string;
  vendorName: string;
  status: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  vendor: Vendor;
  purchaseInvoice: PurchaseInvoiceRef | null;
  items: ReturnItem[];
}

export default function PurchaseReturnDetailPage() {
  const router = useRouter();
  const params = useParams();
  const returnId = params.id as string;

  const {
    data: purchaseReturn,
    error,
    isLoading,
    mutate,
  } = useSWR<PurchaseReturn>(`/api/purchase-returns/${returnId}`);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this purchase return?")) {
      return;
    }

    try {
      const response = await fetch(`/api/purchase-returns/${returnId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete return");
      }

      router.push("/purchases/returns");
    } catch (err) {
      console.error("Error deleting return:", err);
      alert(err instanceof Error ? err.message : "Failed to delete return");
    }
  };

  const handleComplete = async () => {
    if (
      !confirm(
        "Complete this return? This will update inventory and ledger."
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/purchase-returns/${returnId}/complete`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to complete return");
      }

      mutate();
    } catch (err) {
      console.error("Error completing return:", err);
      alert(err instanceof Error ? err.message : "Failed to complete return");
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !purchaseReturn) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">
              {error?.message || "Purchase return not found"}
            </p>
            <Button
              variant="outline"
              onClick={() => router.push("/purchases/returns")}
            >
              Back to Returns
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/purchases/returns")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Returns
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Purchase Return {purchaseReturn.returnNumber}
              </h1>
              <div className="flex items-center gap-4">
                <PurchaseReturnStatusBadge status={purchaseReturn.status} />
                <span className="text-gray-600">
                  Created on {formatDate(purchaseReturn.createdAt)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {purchaseReturn.status === "OPEN" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      router.push(
                        `/purchases/returns/new?edit=${purchaseReturn.id}`
                      )
                    }
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleComplete}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete Return
                  </Button>
                </>
              )}
              {(purchaseReturn.status === "OPEN" ||
                purchaseReturn.status === "CANCELLED") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Return Details */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Return Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Return Date</p>
                  <p className="font-medium">
                    {formatDate(purchaseReturn.date)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <PurchaseReturnStatusBadge
                    status={purchaseReturn.status}
                  />
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Return Items</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">
                        #
                      </th>
                      <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">
                        Item
                      </th>
                      <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">
                        HSN
                      </th>
                      <th className="text-right py-2 px-2 text-sm font-medium text-gray-600">
                        Qty
                      </th>
                      <th className="text-right py-2 px-2 text-sm font-medium text-gray-600">
                        Rate
                      </th>
                      <th className="text-right py-2 px-2 text-sm font-medium text-gray-600">
                        Tax
                      </th>
                      <th className="text-right py-2 px-2 text-sm font-medium text-gray-600">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseReturn.items.map((item, index) => (
                      <tr
                        key={item.id}
                        className="border-b last:border-b-0"
                      >
                        <td className="py-3 px-2 text-sm text-gray-500">
                          {index + 1}
                        </td>
                        <td className="py-3 px-2">
                          <p className="font-medium">{item.item.name}</p>
                          <p className="text-xs text-gray-500">
                            {item.item.itemCode}
                          </p>
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-500">
                          {item.item.hsnCode || "-"}
                        </td>
                        <td className="py-3 px-2 text-right text-sm">
                          {Number(item.quantity).toFixed(3)} {item.item.unit}
                        </td>
                        <td className="py-3 px-2 text-right text-sm">
                          {formatCurrency(Number(item.rate))}
                        </td>
                        <td className="py-3 px-2 text-right text-sm">
                          {Number(item.taxRate)}%
                        </td>
                        <td className="py-3 px-2 text-right font-medium">
                          {formatCurrency(
                            Number(item.amount) + Number(item.taxAmount)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t">
                      <td
                        colSpan={6}
                        className="py-3 px-2 text-right text-sm text-gray-600"
                      >
                        Subtotal:
                      </td>
                      <td className="py-3 px-2 text-right font-medium">
                        {formatCurrency(Number(purchaseReturn.amount))}
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={6}
                        className="py-1 px-2 text-right text-sm text-gray-600"
                      >
                        Tax:
                      </td>
                      <td className="py-1 px-2 text-right font-medium">
                        {formatCurrency(Number(purchaseReturn.taxAmount))}
                      </td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td
                        colSpan={6}
                        className="py-3 px-2 text-right text-sm font-semibold"
                      >
                        Total:
                      </td>
                      <td className="py-3 px-2 text-right text-lg font-bold">
                        {formatCurrency(Number(purchaseReturn.totalAmount))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Reason */}
            {purchaseReturn.reason && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Return Reason</h2>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {purchaseReturn.reason}
                </p>
              </div>
            )}

            {/* Notes */}
            {purchaseReturn.notes && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Notes</h2>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {purchaseReturn.notes}
                </p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Vendor Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Vendor</h2>
              <div className="space-y-3">
                <div>
                  <p className="font-medium">{purchaseReturn.vendor.name}</p>
                  <p className="text-sm text-gray-500">
                    {purchaseReturn.vendor.vendorNumber}
                  </p>
                </div>
                {purchaseReturn.vendor.gstin && (
                  <div>
                    <p className="text-sm text-gray-500">GSTIN</p>
                    <p className="font-medium">
                      {purchaseReturn.vendor.gstin}
                    </p>
                  </div>
                )}
                {purchaseReturn.vendor.email && (
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">
                      {purchaseReturn.vendor.email}
                    </p>
                  </div>
                )}
                {purchaseReturn.vendor.phone && (
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium">
                      {purchaseReturn.vendor.phone}
                    </p>
                  </div>
                )}
                {purchaseReturn.vendor.address && (
                  <div>
                    <p className="text-sm text-gray-500">Address</p>
                    <p className="font-medium">
                      {purchaseReturn.vendor.address}
                      {purchaseReturn.vendor.city &&
                        `, ${purchaseReturn.vendor.city}`}
                      {purchaseReturn.vendor.state &&
                        `, ${purchaseReturn.vendor.state}`}
                      {purchaseReturn.vendor.pincode &&
                        ` - ${purchaseReturn.vendor.pincode}`}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Linked Purchase Invoice */}
            {purchaseReturn.purchaseInvoice && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4">
                  Linked Invoice
                </h2>
                <button
                  onClick={() =>
                    router.push(
                      `/purchases/invoices/${purchaseReturn.purchaseInvoice!.id}`
                    )
                  }
                  className="w-full p-3 text-left border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-teal-600">
                      {purchaseReturn.purchaseInvoice.invoiceNumber}
                    </p>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                      {purchaseReturn.purchaseInvoice.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {formatDate(purchaseReturn.purchaseInvoice.date)} -{" "}
                    {formatCurrency(
                      Number(purchaseReturn.purchaseInvoice.totalAmount)
                    )}
                  </p>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
