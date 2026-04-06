import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signPortalToken, PORTAL_COOKIE_NAME, isSecureCookie } from "@/lib/portal-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerName, password } = body as { customerName: string; password: string };

    if (!customerName?.trim() || !password) {
      return NextResponse.json(
        { error: "Business name and password are required" },
        { status: 400 }
      );
    }

    const customer = await db.customer.findFirst({
      where: {
        name: customerName.trim(),
        status: "ACTIVE",
      },
      select: { id: true, customerNumber: true, name: true, portalPassword: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Per-customer password takes priority; fall back to shared env password
    const expectedPassword = customer.portalPassword ?? process.env.CUSTOMER_PORTAL_PASSWORD;
    if (!expectedPassword || password !== expectedPassword) {
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
