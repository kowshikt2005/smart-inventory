"use client";

import { Badge } from "@/components/ui/badge";

interface PurchaseOrderStatusBadgeProps {
  status: string;
}

export function PurchaseOrderStatusBadge({ status }: PurchaseOrderStatusBadgeProps) {
  const getStatusStyles = () => {
    switch (status) {
      case "OPEN":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "PARTIAL":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "RECEIVED":
        return "bg-green-100 text-green-800 border-green-200";
      case "CANCELLED":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <Badge variant="outline" className={`${getStatusStyles()} font-medium`}>
      {status}
    </Badge>
  );
}

export function PurchaseInvoiceStatusBadge({ status }: { status: string }) {
  const getStatusStyles = () => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "PAID":
        return "bg-green-100 text-green-800 border-green-200";
      case "OVERDUE":
        return "bg-red-100 text-red-800 border-red-200";
      case "CANCELLED":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <Badge variant="outline" className={`${getStatusStyles()} font-medium`}>
      {status}
    </Badge>
  );
}

export function PurchaseReturnStatusBadge({ status }: { status: string }) {
  const getStatusStyles = () => {
    switch (status) {
      case "OPEN":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "COMPLETED":
        return "bg-green-100 text-green-800 border-green-200";
      case "CANCELLED":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <Badge variant="outline" className={`${getStatusStyles()} font-medium`}>
      {status}
    </Badge>
  );
}
