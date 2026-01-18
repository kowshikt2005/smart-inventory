"use client";

import { cn } from "@/lib/utils";
import React from "react";

export function DotBackground({
  children,
  className,
  dotColor = "rgba(100, 116, 139, 0.3)",
  dotSize = "1px",
  dotSpacing = "22px",
}: {
  children?: React.ReactNode;
  className?: string;
  dotColor?: string;
  dotSize?: string;
  dotSpacing?: string;
}) {
  return (
    <div
      className={cn(
        "min-h-screen w-full bg-white",
        className
      )}
      style={{
        backgroundImage: `radial-gradient(${dotColor} ${dotSize}, transparent ${dotSize})`,
        backgroundSize: `${dotSpacing} ${dotSpacing}`,
      }}
    >
      {children}
    </div>
  );
}

export function GridBackground({
  children,
  className,
  gridColor = "rgba(100, 116, 139, 0.08)",
  gridSize = "40px",
}: {
  children?: React.ReactNode;
  className?: string;
  gridColor?: string;
  gridSize?: string;
}) {
  return (
    <div
      className={cn(
        "min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100",
        className
      )}
      style={{
        backgroundImage: `linear-gradient(${gridColor} 1px, transparent 1px), linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`,
        backgroundSize: `${gridSize} ${gridSize}`,
      }}
    >
      {children}
    </div>
  );
}
