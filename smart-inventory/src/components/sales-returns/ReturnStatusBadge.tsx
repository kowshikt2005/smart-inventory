"use client";

import { Badge } from "@/components/ui/badge";

interface ReturnStatusBadgeProps {
  status: string;
}

export function ReturnStatusBadge({ status }: ReturnStatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "OPEN":
        return {
          label: "Open",
          className: "bg-yellow-100 text-yellow-800 border-yellow-200",
        };
      case "COMPLETED":
        return {
          label: "Completed",
          className: "bg-green-100 text-green-800 border-green-200",
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
