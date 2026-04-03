"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ReactNode } from "react";
import Link from "next/link";
import { Loader2, ShieldAlert } from "lucide-react";
import type { PermissionKey } from "@/types/permissions";

interface AuthGuardProps {
  children: ReactNode;
  requiredPermission?: PermissionKey;
}

export function AuthGuard({ children, requiredPermission }: AuthGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/login");
      return;
    }

    if (requiredPermission) {
      const perms = session.user.permissions;
      if (!perms?.[requiredPermission]?.view) {
        router.push("/");
        return;
      }
    }
  }, [session, status, router, requiredPermission]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (requiredPermission) {
    const perms = session.user.permissions;
    if (!perms?.[requiredPermission]?.view) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-sm">
            <ShieldAlert className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">You don&apos;t have permission to access this page. Contact your administrator if you need access.</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
