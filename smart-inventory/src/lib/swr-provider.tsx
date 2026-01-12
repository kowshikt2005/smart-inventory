"use client";

import { SWRConfig } from "swr";
import { ReactNode, useMemo } from "react";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error("An error occurred while fetching the data.");
    throw error;
  }
  return res.json();
};

export function SWRProvider({ children }: { children: ReactNode }) {
  const swrConfig = useMemo(
    () => ({
      fetcher,
      revalidateOnFocus: false, // Don't refetch when window regains focus
      revalidateOnReconnect: false, // Don't refetch when reconnecting
      revalidateIfStale: false, // Don't revalidate stale data automatically
      dedupingInterval: 300000, // Dedupe requests within 5 minutes
      refreshInterval: 0, // Don't auto-refresh (only fetch on demand)
      shouldRetryOnError: false, // Don't retry on error
      errorRetryCount: 2, // Retry failed requests max 2 times
      keepPreviousData: true, // Keep showing previous data while fetching new data
    }),
    []
  );

  return <SWRConfig value={swrConfig}>{children}</SWRConfig>;
}
