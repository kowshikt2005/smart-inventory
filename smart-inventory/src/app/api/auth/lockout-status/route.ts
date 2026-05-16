import { NextRequest, NextResponse } from "next/server";
import { getLoginLockoutRemaining } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("identifier");

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || request.headers.get("cf-connecting-ip")
    || "unknown";

  // Normalize the same way recordFailedLogin does in auth.ts
  const identifier = raw ? raw.toLowerCase().trim() : "";
  const normalized = !identifier.includes("@")
    ? identifier.replace(/\D/g, "")
    : identifier;

  const remainingSeconds = identifier
    ? getLoginLockoutRemaining(normalized, ip)
    : getLoginLockoutRemaining("", ip);

  return NextResponse.json({
    locked: remainingSeconds > 0,
    remainingSeconds,
  });
}
