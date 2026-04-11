import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyOTPPreview } from "@/lib/otp";
import { cache } from "@/lib/cache";

const OTP_VERIFY_HTTP_PREFIX = "otp_verify_http:";
const OTP_VERIFY_HTTP_WINDOW_SECONDS = 300;
const OTP_VERIFY_HTTP_MAX_ATTEMPTS = 20;

function normalizePhone(phone: string): string {
  let normalizedPhone = phone.replace(/[\s-]/g, "");
  if (!normalizedPhone.startsWith("+")) {
    normalizedPhone = "+91" + normalizedPhone;
  }
  return normalizedPhone;
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  return realIp?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const { phone, otp } = await request.json();

    if (!phone || !otp) {
      return NextResponse.json(
        { error: "Phone number and OTP are required" },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhone(phone);
    const rateKey = `${OTP_VERIFY_HTTP_PREFIX}${normalizedPhone}:${getClientIp(request)}`;
    const attempts = cache.get<number>(rateKey) ?? 0;
    if (attempts >= OTP_VERIFY_HTTP_MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please try again later." },
        { status: 429 }
      );
    }
    cache.set(rateKey, attempts + 1, OTP_VERIFY_HTTP_WINDOW_SECONDS);

    // Pre-check only: do not consume OTP here.
    const isValid = await verifyOTPPreview(normalizedPhone, otp);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid or expired OTP" },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { phone: normalizedPhone },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, verified: true });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { error: "Failed to verify OTP" },
      { status: 500 }
    );
  }
}
