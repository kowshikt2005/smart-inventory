import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { PATH_TO_PERMISSION } from "@/types/permissions";
import type { RolePermissions } from "@/types/permissions";

const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;
const cookieName = useSecureCookies
  ? "__Secure-authjs.session-token"
  : "authjs.session-token";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to login page and auth API routes
  if (pathname === "/login" || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // Get the token from the request
  // Must specify cookieName explicitly because nginx proxies HTTPS → HTTP internally,
  // so getToken() would auto-detect "http" and look for the wrong cookie name.
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName,
  });

  // If no token and trying to access protected route, redirect to login
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Permission-based page access check (defense-in-depth)
  // Only applies to page routes, not API routes (those have their own checks)
  // Admin role bypasses all page permission checks
  if (!pathname.startsWith("/api/") && token.roleName !== "ADMIN") {
    // Try exact match first, then walk up the path to catch sub-routes
    // e.g. /sales/orders/new → /sales/orders → found in PATH_TO_PERMISSION
    let checkPath = pathname;
    let permissionKey: string | undefined;
    while (checkPath) {
      if (PATH_TO_PERMISSION[checkPath]) {
        permissionKey = PATH_TO_PERMISSION[checkPath];
        break;
      }
      const lastSlash = checkPath.lastIndexOf("/");
      if (lastSlash <= 0) break;
      checkPath = checkPath.substring(0, lastSlash);
    }

    if (permissionKey) {
      const permissions = token.permissions as RolePermissions | undefined;
      if (permissions && !permissions[permissionKey as keyof RolePermissions]?.view) {
        // Find the first page this user does have access to
        const firstPermittedPath = Object.entries(PATH_TO_PERMISSION).find(
          ([, key]) => permissions[key as keyof RolePermissions]?.view === true
        )?.[0];

        if (firstPermittedPath) {
          // User has at least one permission — send them where they can go
          return NextResponse.redirect(new URL(firstPermittedPath, request.url));
        }

        // User has zero permissions — sign them out
        const loginUrl = new URL("/login", request.url);
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete(cookieName);
        return response;
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
