import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendOTP } from "@/lib/otp";

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Normalize phone for DB lookup
    let normalizedPhone = phone.replace(/[\s-]/g, "");
    if (!normalizedPhone.startsWith("+")) {
      normalizedPhone = "+91" + normalizedPhone;
    }

    // Check if user exists with this phone number
    const user = await db.user.findUnique({
      where: { phone: normalizedPhone },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "No active account found with this phone number" },
        { status: 404 }
      );
    }

    const result = await sendOTP(phone);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 429 }
      );
    }

    return NextResponse.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("Send OTP error:", error);
    return NextResponse.json(
      { error: "Failed to send OTP" },
      { status: 500 }
    );
  }
}
