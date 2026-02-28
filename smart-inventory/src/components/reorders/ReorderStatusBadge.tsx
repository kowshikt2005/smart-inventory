"use client";

import { Badge } from "@/components/ui/badge";
import { Clock, PackageCheck, XCircle } from "lucide-react";

interface ReorderStatusBadgeProps {
  status: string;
  showIcon?: boolean;
  size?: "sm" | "md";
}

const RO_STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: typeof Clock }
> = {
  PENDING: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
    icon: Clock,
  },
  CONVERTED: {
    label: "Converted",
    className: "bg-green-100 text-green-700 hover:bg-green-100",
    icon: PackageCheck,
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-red-100 text-red-700 hover:bg-red-100",
    icon: XCircle,
  },
};

export function ReorderStatusBadge({
  status,
  showIcon = true,
  size = "md",
}: ReorderStatusBadgeProps) {
  const config = RO_STATUS_CONFIG[status] || {
    label: status,
    className: "bg-gray-100 text-gray-700 hover:bg-gray-100",
    icon: Clock,
  };

  const Icon = config.icon;
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <Badge className={`${config.className} text-xs font-medium`}>
      {showIcon && <Icon className={`${iconSize} mr-1`} />}
      {config.label}
    </Badge>
  );
}
