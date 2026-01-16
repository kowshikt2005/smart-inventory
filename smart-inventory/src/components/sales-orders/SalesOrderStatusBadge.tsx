"use client";

import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Pause,
  XCircle,
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
  HOLD: {
    label: "Hold",
    className: "bg-orange-100 text-orange-700 hover:bg-orange-100",
    icon: Pause,
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-red-100 text-red-700 hover:bg-red-100",
    icon: XCircle,
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
