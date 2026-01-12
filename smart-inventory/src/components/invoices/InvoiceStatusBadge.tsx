"use client";

import { Badge } from "@/components/ui/badge";

interface InvoiceStatusBadgeProps {
  status: string;
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "PENDING":
        return {
          label: "Pending",
          className: "bg-yellow-100 text-yellow-800 border-yellow-200",
        };
      case "PARTIAL":
        return {
          label: "Partial",
          className: "bg-blue-100 text-blue-800 border-blue-200",
        };
      case "PAID":
        return {
          label: "Paid",
          className: "bg-green-100 text-green-800 border-green-200",
        };
      case "OVERDUE":
        return {
          label: "Overdue",
          className: "bg-red-100 text-red-800 border-red-200",
        };
      case "CANCELLED":
        return {
          label: "Cancelled",
          className: "bg-gray-100 text-gray-800 border-gray-200",
        };
      default:
        return {
          label: status,
          className: "bg-gray-100 text-gray-800 border-gray-200",
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
