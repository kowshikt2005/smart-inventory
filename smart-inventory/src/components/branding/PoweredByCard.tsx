"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface PoweredByCardProps {
  className?: string;
  buttonClassName?: string;
  variant?: "card" | "link";
}

export function PoweredByCard({
  className,
  buttonClassName,
  variant = "card",
}: PoweredByCardProps) {
  return (
    <Dialog>
      <div className={className}>
        <DialogTrigger asChild>
          <button
            type="button"
            className={cn(
              "text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-indigo-950",
              variant === "card"
                ? "w-full rounded-lg border border-amber-300/25 bg-white/[0.06] px-3 py-2 text-left text-white/60 hover:border-amber-300/45 hover:bg-white/[0.1] hover:text-white"
                : "rounded px-1 py-1 font-medium text-amber-400/60 hover:text-amber-400 active:text-amber-300",
              buttonClassName,
            )}
            aria-label="View KSolutions logo"
          >
            Powered by{" "}
            <span className={cn("font-semibold", variant === "card" && "text-amber-300")}>
              KSolutions
            </span>
          </button>
        </DialogTrigger>
      </div>
      <DialogContent className="max-w-md overflow-hidden border-indigo-100 p-0">
        <DialogHeader className="border-b border-indigo-100 bg-indigo-50/60 px-6 py-5 pr-12">
          <DialogTitle className="text-indigo-950">KSolutions</DialogTitle>
          <DialogDescription>Technology partner for this ERP system.</DialogDescription>
        </DialogHeader>
        <div className="bg-white p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-ksolutions.jpg"
            alt="KSolutions logo"
            className="max-h-48 w-full object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
