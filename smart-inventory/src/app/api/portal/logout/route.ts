import { NextRequest, NextResponse } from "next/server";
import { PORTAL_COOKIE_NAME, portalCookieOptions } from "@/lib/portal-auth";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  // Delete with same options as set — sameSite/secure must match for the
  // browser to remove the cookie correctly on some clients.
  response.cookies.set(PORTAL_COOKIE_NAME, "", {
    ...portalCookieOptions(request),
    maxAge: 0,
  });
  return response;
}
