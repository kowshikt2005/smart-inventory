import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyOTP } from "@/lib/otp";

export async function POST(request: NextRequest) {
  try {
    const { phone, otp } = await request.json();

    if (!phone || !otp) {
      return NextResponse.json(
        { error: "Phone number and OTP are required" },
        { status: 400 }
      );
    }

    const isValid = await verifyOTP(phone, otp);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid or expired OTP" },
        { status: 401 }
      );
    }

    // Normalize phone for DB lookup
    let normalizedPhone = phone.replace(/[\s-]/g, "");
    if (!normalizedPhone.startsWith("+")) {
      normalizedPhone = "+91" + normalizedPhone;
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
