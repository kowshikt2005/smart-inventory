"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { ReactNode } from "react";

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider
      // Reduce session API calls - only refetch every 5 minutes
      refetchInterval={5 * 60}
      // Don't refetch on window focus (prevents duplicate calls)
      refetchOnWindowFocus={false}
    >
      {children}
    </NextAuthSessionProvider>
  );
}