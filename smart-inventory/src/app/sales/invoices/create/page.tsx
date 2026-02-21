"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Loader2, FileText } from "lucide-react";
import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface OrderItem {
  id: string;
  itemId: string;
  quantity: number;
  rate: number;
  discountPercent: number;
  taxRate: number;
  taxAmount: number;
  amount: number;
  item: {
    id: string;
    itemCode: string;
    name: string;
    unit: string;
    hsnCode: string | null;
    gstRate: number;
    mrp: number | null;
    sellingPrice: number;
  };
}

interface SalesOrder {
  id: string;
  orderNumber: string;
  orderDate: string;
  customerId: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  customer: {
    id: string;
    customerNumber: string;
    name: string;
    gstin: string | null;
    city: string | null;
    state: string | null;
  };
  items: OrderItem[];
}

interface InsufficientStockItem {
  itemName: string;
  itemCode: string;
  required: number;
  available: number;
  shortfall: number;
}

function CreateInvoiceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const salesOrderId = searchParams.get("salesOrderId");

  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!salesOrderId) {
      setError("No sales order ID provided");
      setIsLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        const response = await fetch(`/api/sales-orders/${salesOrderId}`);
        if (!response.ok) throw new Error("Failed to fetch order");
        const data = await response.json();
        setOrder(data);
        setNotes(data.notes || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load order");
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrder();
  }, [salesOrderId]);

  // Compute display items from order (read-only, no recalculation needed)
  const displayItems = useMemo(() => {
    if (!order) return [];

    return order.items.map((orderItem) => {
      const taxableAmount = Number(orderItem.amount);
      const taxAmount = Number(orderItem.taxAmount);
      const totalAmount = taxableAmount + taxAmount;

      return {
        itemId: orderItem.itemId,
        itemCode: orderItem.item.itemCode,
        itemName: orderItem.item.name,
        hsnCode: orderItem.item.hsnCode,
        unit: orderItem.item.unit,
        quantity: Number(orderItem.quantity),
        rate: Number(orderItem.rate),
        discountPercent: Number(orderItem.discountPercent),
        taxRate: Number(orderItem.taxRate),
        taxAmount,
        amount: taxableAmount,
        totalAmount,
      };
    });
  }, [order]);

  // Compute totals
  const totals = useMemo(() => {
    const subtotal = displayItems.reduce((sum, item) => sum + item.amount, 0);
    const totalTax = displayItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const totalAmount = subtotal + totalTax;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
    };
  }, [displayItems]);

  const handleCreateInvoice = async () => {
    if (!order || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/sales-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesOrderId: order.id,
          invoiceDate,
          notes: notes || undefined,
        }),
      });

      const data = await response.json();

      if (response.status === 409 && data.invoiceId) {
        router.push(`/sales/invoices/${data.invoiceId}`);
        return;
      }

      if (!response.ok && data.insufficientStock) {
        const stockDetails = data.insufficientStock
          .map(
            (item: InsufficientStockItem) =>
              `${item.itemName} (${item.itemCode}):\n  Required: ${item.required}\n  Available: ${item.available}\n  Missing: ${item.shortfall}`
          )
          .join("\n\n");
        alert(`${data.error}\n\n${stockDetails}`);
        setIsSubmitting(false);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to create invoice");
      }

      router.push(`/sales/invoices/${data.id}`);
    } catch (err) {
      console.error("Error creating invoice:", err);
      alert(err instanceof Error ? err.message : "Failed to create invoice");
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !order) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error || "Order not found"}
          </div>
          <Button
            onClick={() => router.push("/sales/orders")}
            variant="outline"
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </Button>
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
            onClick={() => router.back()}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-foreground">
            Create Invoice from {order.orderNumber}
          </h1>
          <p className="text-muted-foreground">
            Review order items before creating the invoice
          </p>
        </div>

        {/* Order & Customer Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-border/60 p-4">
            <p className="text-sm text-muted-foreground mb-1">Customer</p>
            <p className="font-semibold">{order.customer.name}</p>
            <p className="text-xs text-muted-foreground">
              {order.customer.customerNumber}
            </p>
            {order.customer.gstin && (
              <p className="text-xs text-muted-foreground mt-1">
                GSTIN: {order.customer.gstin}
              </p>
            )}
          </div>
          <div className="bg-white rounded-xl border border-border/60 p-4">
            <label className="text-sm text-muted-foreground mb-1 block">
              Invoice Date
            </label>
            <Input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="bg-white rounded-xl border border-border/60 p-4">
            <label className="text-sm text-muted-foreground mb-1 block">
              Notes
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Invoice notes..."
              className="mt-1 h-[60px] resize-none"
            />
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden mb-6">
          <div className="p-4 border-b border-border/60">
            <h2 className="text-lg font-semibold">Invoice Items</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold">Item</TableHead>
                  <TableHead className="font-semibold">HSN</TableHead>
                  <TableHead className="font-semibold text-right">Qty</TableHead>
                  <TableHead className="font-semibold text-right">Rate</TableHead>
                  <TableHead className="font-semibold text-right">Disc %</TableHead>
                  <TableHead className="font-semibold text-right">Tax %</TableHead>
                  <TableHead className="font-semibold text-right">Tax Amt</TableHead>
                  <TableHead className="font-semibold text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayItems.map((item) => (
                  <TableRow key={item.itemId}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.itemName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.itemCode}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.hsnCode || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.quantity} {item.unit}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(item.rate)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {item.discountPercent > 0 ? (
                        <span className="text-orange-600">{item.discountPercent}%</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {item.taxRate}%
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(item.taxAmount)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.totalAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Totals and Action */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-border/60 p-6 w-full md:w-96">
            <h3 className="text-lg font-semibold mb-3">Invoice Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">
                  {formatCurrency(totals.subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-medium">
                  {formatCurrency(totals.totalTax)}
                </span>
              </div>
              <hr />
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formatCurrency(totals.totalAmount)}</span>
              </div>
            </div>
            <Button
              onClick={handleCreateInvoice}
              disabled={isSubmitting}
              className="w-full mt-4 bg-primary hover:bg-primary/90 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Invoice...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Create Invoice
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function CreateInvoicePage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="p-6 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
          </div>
        </DashboardLayout>
      }
    >
      <CreateInvoiceContent />
    </Suspense>
  );
}
