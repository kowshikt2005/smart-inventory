"use client";

import { WifiOff } from 'lucide-react';
import { RetryButton } from './RetryButton';
import { useCompanyBranding } from "@/hooks/use-company-branding";

export default function OfflinePage() {
  const { branding } = useCompanyBranding();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2D2A5E] via-[#272462] to-[#1A1740] flex flex-col items-center justify-center px-6 text-white">
      <main className="flex flex-col items-center gap-6 max-w-sm text-center">

        {/* Logo — matches sidebar logo box */}
        <div className="rounded-xl bg-white px-6 py-3 mb-2 shadow-lg">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={`${branding.companyName} logo`} className="h-9 object-contain" />
          ) : (
            <span className="text-sm font-semibold text-indigo-950">{branding.companyName}</span>
          )}
        </div>

        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
          <WifiOff className="h-8 w-8 text-amber-400" strokeWidth={1.5} />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">You&apos;re offline</h1>
          <p className="text-sm text-white/60 leading-relaxed">
            Check your internet connection and try again.
          </p>
        </div>

        <RetryButton />
      </main>
    </div>
  );
}
