"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ReactNode } from "react";
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
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
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don&apos;t have permission to access this page.</p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
