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
      revalidateOnFocus: true, // Refetch when window regains focus (e.g. navigating back)
      revalidateOnReconnect: true, // Refetch when reconnecting
      revalidateIfStale: true, // Revalidate stale data automatically
      dedupingInterval: 5000, // Dedupe requests within 5 seconds
      refreshInterval: 0, // Don't auto-refresh
      shouldRetryOnError: false, // Don't retry on error
      errorRetryCount: 2, // Retry failed requests max 2 times
      keepPreviousData: true, // Keep showing previous data while fetching new data
    }),
    []
  );

  return <SWRConfig value={swrConfig}>{children}</SWRConfig>;
}
