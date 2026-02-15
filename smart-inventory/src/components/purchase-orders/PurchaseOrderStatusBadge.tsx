"use client";

import { Badge } from "@/components/ui/badge";
import {
  Clock,
  PackageCheck,
  XCircle,
  Truck,
  AlertCircle,
  CreditCard,
  Ban,
} from "lucide-react";

interface PurchaseOrderStatusBadgeProps {
  status: string;
  showIcon?: boolean;
  size?: "sm" | "md";
}

const PO_STATUS_CONFIG: Record<
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
  PARTIAL: {
    label: "Partial",
    className: "bg-orange-100 text-orange-700 hover:bg-orange-100",
    icon: Truck,
  },
  RECEIVED: {
    label: "Received",
    className: "bg-green-100 text-green-700 hover:bg-green-100",
    icon: PackageCheck,
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-red-100 text-red-700 hover:bg-red-100",
    icon: XCircle,
  },
};

export function PurchaseOrderStatusBadge({
  status,
  showIcon = true,
  size = "md",
}: PurchaseOrderStatusBadgeProps) {
  const config = PO_STATUS_CONFIG[status] || {
    label: status,
    className: "bg-gray-100 text-gray-700 hover:bg-gray-100",
    icon: Clock,
  };

  const Icon = config.icon;
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  const textSize = "text-xs";

  return (
    <Badge className={`${config.className} ${textSize} font-medium`}>
      {showIcon && <Icon className={`${iconSize} mr-1`} />}
      {config.label}
    </Badge>
  );
}

// --- Purchase Invoice Status Badge ---

interface PurchaseInvoiceStatusBadgeProps {
  status: string;
  showIcon?: boolean;
  size?: "sm" | "md";
}

const PI_STATUS_CONFIG: Record<
  string,
  {
    label: string;
    className: string;
    icon: typeof Clock;
  }
> = {
  PENDING: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
    icon: Clock,
  },
  PARTIAL: {
    label: "Partial",
    className: "bg-orange-100 text-orange-700 hover:bg-orange-100",
    icon: AlertCircle,
  },
  PAID: {
    label: "Paid",
    className: "bg-green-100 text-green-700 hover:bg-green-100",
    icon: CreditCard,
  },
  OVERDUE: {
    label: "Overdue",
    className: "bg-red-100 text-red-700 hover:bg-red-100",
    icon: AlertCircle,
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-gray-100 text-gray-700 hover:bg-gray-100",
    icon: Ban,
  },
};

export function PurchaseInvoiceStatusBadge({
  status,
  showIcon = true,
  size = "md",
}: PurchaseInvoiceStatusBadgeProps) {
  const config = PI_STATUS_CONFIG[status] || {
    label: status,
    className: "bg-gray-100 text-gray-700 hover:bg-gray-100",
    icon: Clock,
  };

  const Icon = config.icon;
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  const textSize = "text-xs";

  return (
    <Badge className={`${config.className} ${textSize} font-medium`}>
      {showIcon && <Icon className={`${iconSize} mr-1`} />}
      {config.label}
    </Badge>
  );
}

// --- Purchase Return Status Badge ---

interface PurchaseReturnStatusBadgeProps {
  status: string;
  showIcon?: boolean;
  size?: "sm" | "md";
}

const PR_STATUS_CONFIG: Record<
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
  COMPLETED: {
    label: "Completed",
    className: "bg-green-100 text-green-700 hover:bg-green-100",
    icon: PackageCheck,
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-red-100 text-red-700 hover:bg-red-100",
    icon: XCircle,
  },
};

export function PurchaseReturnStatusBadge({
  status,
  showIcon = true,
  size = "md",
}: PurchaseReturnStatusBadgeProps) {
  const config = PR_STATUS_CONFIG[status] || {
    label: status,
    className: "bg-gray-100 text-gray-700 hover:bg-gray-100",
    icon: Clock,
  };

  const Icon = config.icon;
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  const textSize = "text-xs";

  return (
    <Badge className={`${config.className} ${textSize} font-medium`}>
      {showIcon && <Icon className={`${iconSize} mr-1`} />}
      {config.label}
    </Badge>
  );
}
