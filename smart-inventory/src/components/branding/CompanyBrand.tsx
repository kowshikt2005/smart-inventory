"use client";

import { Building2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCompanyBranding } from "@/hooks/use-company-branding";
import { cn } from "@/lib/utils";

interface CompanyBrandProps {
  className?: string;
  buttonClassName?: string;
  description?: string;
}

export function CompanyBrand({
  className,
  buttonClassName,
  description = "Company identity configured in Staff Settings.",
}: CompanyBrandProps) {
  const { branding } = useCompanyBranding();

  return (
    <Dialog>
      <div className={className}>
        <DialogTrigger asChild>
          <button
            type="button"
            className={cn(
              "max-w-full rounded-md text-left font-semibold leading-tight focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2",
              buttonClassName,
            )}
            aria-label={`View ${branding.companyName} logo`}
          >
            {branding.companyName}
          </button>
        </DialogTrigger>
      </div>
      <DialogContent className="max-w-md overflow-hidden border-indigo-100 p-0">
        <DialogHeader className="border-b border-indigo-100 bg-indigo-50/60 px-6 py-5 pr-12">
          <DialogTitle className="text-indigo-950">{branding.companyName}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-48 items-center justify-center bg-white p-8">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={`${branding.companyName} logo`}
              className="max-h-56 w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-center text-slate-400">
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
                <Building2 className="h-10 w-10" aria-hidden="true" />
              </div>
              <p className="text-sm">No company logo uploaded</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
