"use client";

import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Truck,
  Pause,
  XCircle,
  CheckCircle2,
} from "lucide-react";

interface SalesOrderStatusBadgeProps {
  status: string;
  showIcon?: boolean;
  size?: "sm" | "md";
}

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    className: string;
    icon: typeof Clock;
  }
> = {
  OPEN: {
    label: "Open",
    className: "bg-blue-100 text-blue-700 hover:bg-blue-100",
    icon: Clock,
  },
  DELIVER: {
    label: "Ready",
    className: "bg-green-100 text-green-700 hover:bg-green-100",
    icon: Truck,
  },
  HOLD: {
    label: "On Hold",
    className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
    icon: Pause,
  },
  REJECT: {
    label: "Rejected",
    className: "bg-red-100 text-red-700 hover:bg-red-100",
    icon: XCircle,
  },
  DELIVERED: {
    label: "Delivered",
    className: "bg-purple-100 text-purple-700 hover:bg-purple-100",
    icon: CheckCircle2,
  },
};

export function SalesOrderStatusBadge({
  status,
  showIcon = true,
  size = "md",
}: SalesOrderStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    className: "bg-gray-100 text-gray-700 hover:bg-gray-100",
    icon: Clock,
  };

  const Icon = config.icon;
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  const textSize = size === "sm" ? "text-xs" : "text-xs";

  return (
    <Badge className={`${config.className} ${textSize} font-medium`}>
      {showIcon && <Icon className={`${iconSize} mr-1`} />}
      {config.label}
    </Badge>
  );
}
