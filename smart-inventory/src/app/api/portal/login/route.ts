import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signPortalToken, PORTAL_COOKIE_NAME, isSecureCookie } from "@/lib/portal-auth";

const DEFAULT_PIN = "123456";

/** Extract the last 10 digits from any phone format */
function extractDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Indian numbers: take last 10 digits (strips country code 91)
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, pin } = body as { phone: string; pin: string };

    if (!phone?.trim() || !pin) {
      return NextResponse.json(
        { error: "Phone number and PIN are required" },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { error: "PIN must be exactly 6 digits" },
        { status: 400 }
      );
    }

    const last10 = extractDigits(phone);
    if (last10.length < 10) {
      return NextResponse.json(
        { error: "Please enter a valid 10-digit phone number" },
        { status: 400 }
      );
    }

    // Search by the last 10 digits so it works regardless of how the
    // phone was stored (9876543210, +919876543210, +91 9876543210, etc.)
    const customer = await db.customer.findFirst({
      where: { phone: { endsWith: last10 } },
      select: {
        id: true,
        customerNumber: true,
        name: true,
        portalPassword: true,
        status: true,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (customer.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Your account has been deactivated. Please contact your sales representative." },
        { status: 403 }
      );
    }

    const expectedPin = customer.portalPassword || DEFAULT_PIN;
    if (pin !== expectedPin) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await signPortalToken({
      customerId: customer.id,
      customerNumber: customer.customerNumber,
      name: customer.name,
    });

    const response = NextResponse.json({
      ok: true,
      customer: { name: customer.name, customerNumber: customer.customerNumber },
    });

    response.cookies.set(PORTAL_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isSecureCookie(),
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
