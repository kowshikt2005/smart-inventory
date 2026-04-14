"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const INACTIVITY_MS = 20 * 60 * 1000; // 20 minutes

const TRACKED_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
] as const;

export function InactivityGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          await fetch("/api/portal/logout", { method: "POST" });
        } catch {
          // ignore — redirect happens regardless
        }
        router.push("/portal/login");
      }, INACTIVITY_MS);
    };

    resetTimer();

    TRACKED_EVENTS.forEach((ev) =>
      window.addEventListener(ev, resetTimer, { passive: true })
    );

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      TRACKED_EVENTS.forEach((ev) =>
        window.removeEventListener(ev, resetTimer)
      );
    };
  }, [router]);

  return <>{children}</>;
}
