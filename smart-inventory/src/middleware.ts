import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { PATH_TO_PERMISSION } from "@/types/permissions";
import type { RolePermissions } from "@/types/permissions";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to login page and auth API routes
  if (pathname === "/login" || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // Get the token from the request
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
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
    const permissionKey = PATH_TO_PERMISSION[pathname];
    if (permissionKey) {
      const permissions = token.permissions as RolePermissions | undefined;
      if (permissions && !permissions[permissionKey]?.view) {
        const homeUrl = new URL("/", request.url);
        return NextResponse.redirect(homeUrl);
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
