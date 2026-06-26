"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import useSWR from "swr";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

type NotifResponse = {
  notifications: Notification[];
  unreadCount: number;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function playChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio not available
  }
}

function sendBrowserNotification(notif: Notification) {
  if (typeof window === "undefined" || Notification.permission !== "granted") return;
  try {
    const n = new Notification(notif.title, {
      body: notif.message ?? undefined,
    });
    if (notif.link) {
      n.onclick = () => {
        window.focus();
        window.location.href = notif.link!;
      };
    }
  } catch {
    // Browser notification not available
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const prevUnreadRef = useRef(0);
  const seenIds = useRef(new Set<string>());

  const { data, mutate } = useSWR<NotifResponse>(
    "/api/notifications",
    fetcher,
    { refreshInterval: 30000 }
  );

  const notifications = useMemo(() => data?.notifications ?? [], [data]);
  const unreadCount = data?.unreadCount ?? 0;

  useEffect(() => {
    if (unreadCount > prevUnreadRef.current && prevUnreadRef.current > 0) {
      const newNotif = notifications.find((n) => !n.read && !seenIds.current.has(n.id));
      if (newNotif) {
        seenIds.current.add(newNotif.id);
        toast(newNotif.title, {
          description: newNotif.message ?? undefined,
          action: newNotif.link
            ? { label: "View", onClick: () => { window.location.href = newNotif.link!; } }
            : undefined,
          duration: 6000,
        });
        playChime();
        sendBrowserNotification(newNotif);
      }
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, notifications]);

  const requestNotifPermission = useCallback(() => {
    if (typeof window === "undefined") return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) mutate();
    } catch {
      // silently fail
    }
  };

  const handleMarkOneRead = async (id: string, link: string | null) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      if (res.ok) mutate();
    } catch {
      // silently fail
    }
    if (link) {
      window.location.href = link;
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <DropdownMenu open={open} onOpenChange={(o) => { setOpen(o); if (o) requestNotifPermission(); }}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end" forceMount>
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-primary hover:underline font-normal"
            >
              Mark all as read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto">
            {notifications.map((notif) => (
              <DropdownMenuItem
                key={notif.id}
                className={cn(
                  "flex flex-col items-start gap-0.5 py-3 px-4 cursor-pointer",
                  !notif.read && "bg-muted/40"
                )}
                onClick={() => handleMarkOneRead(notif.id, notif.link)}
              >
                <div className="flex items-center gap-2 w-full">
                  {!notif.read && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                  <span className="text-sm font-medium text-foreground">
                    {notif.title}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                    {timeAgo(notif.createdAt)}
                  </span>
                </div>
                {notif.message && (
                  <span className="text-xs text-muted-foreground pl-4">
                    {notif.message}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
