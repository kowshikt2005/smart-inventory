"use client";

import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, XCircle } from "lucide-react";

interface StockStatusBadgeProps {
  status: "Available" | "Partial" | "Unavailable";
  showIcon?: boolean;
}

const STATUS_CONFIG = {
  Available: {
    label: "In Stock",
    className: "bg-green-100 text-green-700 hover:bg-green-100",
    icon: Package,
  },
  Partial: {
    label: "Partial",
    className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
    icon: AlertTriangle,
  },
  Unavailable: {
    label: "Out of Stock",
    className: "bg-red-100 text-red-700 hover:bg-red-100",
    icon: XCircle,
  },
};

export function StockStatusBadge({
  status,
  showIcon = true,
}: StockStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.Unavailable;
  const Icon = config.icon;

  return (
    <Badge className={`${config.className} text-xs font-medium`}>
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {config.label}
    </Badge>
  );
}
