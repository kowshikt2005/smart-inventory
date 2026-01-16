"use client";

import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, XCircle } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ItemStockDetail {
  itemId: string;
  itemCode: string;
  itemName: string;
  orderedQty: number;
  availableQty: number;
  missingQty: number;
  unit: string;
}

interface StockStatusBadgeProps {
  status: "Available" | "Partial" | "Unavailable";
  showIcon?: boolean;
  stockSummary?: {
    totalItems: number;
    availableItems: number;
    partialItems: number;
    unavailableItems: number;
  };
  itemStockDetails?: ItemStockDetail[];
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
  stockSummary,
  itemStockDetails,
}: StockStatusBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const badgeRef = useRef<HTMLDivElement>(null);
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.Unavailable;
  const Icon = config.icon;

  // Only show detailed tooltip for Partial/Unavailable with item details
  const hasDetailedInfo = (status === "Partial" || status === "Unavailable") && itemStockDetails && itemStockDetails.length > 0;

  // Calculate tooltip position when shown
  useEffect(() => {
    if (showTooltip && badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX + rect.width / 2,
      });
    }
  }, [showTooltip]);

  // Build simple tooltip text for summary
  let tooltipText = "";
  if (stockSummary && !hasDetailedInfo) {
    const parts = [];
    if (stockSummary.availableItems > 0) {
      parts.push(`${stockSummary.availableItems} item(s) fully available`);
    }
    if (stockSummary.partialItems > 0) {
      parts.push(`${stockSummary.partialItems} item(s) partially available`);
    }
    if (stockSummary.unavailableItems > 0) {
      parts.push(`${stockSummary.unavailableItems} item(s) out of stock`);
    }
    tooltipText = parts.join("\n");
  }

  return (
    <>
      <div className="relative inline-block" ref={badgeRef}>
        <Badge
          className={`${config.className} text-xs font-medium ${hasDetailedInfo ? 'cursor-pointer' : 'cursor-help'}`}
          title={!hasDetailedInfo ? tooltipText || undefined : undefined}
          onMouseEnter={() => hasDetailedInfo && setShowTooltip(true)}
          onMouseLeave={() => hasDetailedInfo && setShowTooltip(false)}
        >
          {showIcon && <Icon className="h-3 w-3 mr-1" />}
          {config.label}
        </Badge>
      </div>

      {/* Detailed Tooltip - Rendered via Portal */}
      {hasDetailedInfo && showTooltip && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed z-[9999] w-96 bg-white border border-gray-200 rounded-lg shadow-lg p-4"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            transform: 'translateX(-50%)',
          }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-gray-200"></div>
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-r-[7px] border-b-[7px] border-transparent border-b-white"></div>

          <h4 className="font-semibold text-sm text-gray-900 mb-3">Stock Shortage Details</h4>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {itemStockDetails.map((item) => (
              <div key={item.itemId} className="border-b border-gray-100 pb-2 last:border-0">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-900">{item.itemName}</p>
                    <p className="text-xs text-gray-500">{item.itemCode}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                  <div>
                    <span className="text-gray-600">Ordered:</span>
                    <span className="ml-1 font-medium text-gray-900">
                      {item.orderedQty} {item.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Available:</span>
                    <span className="ml-1 font-medium text-green-600">
                      {item.availableQty} {item.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Missing:</span>
                    <span className="ml-1 font-medium text-red-600">
                      {item.missingQty} {item.unit}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
