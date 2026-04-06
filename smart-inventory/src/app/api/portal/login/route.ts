import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signPortalToken, PORTAL_COOKIE_NAME, useSecurePortalCookie } from "@/lib/portal-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerNumber, password } = body as { customerNumber: string; password: string };

    if (!customerNumber?.trim() || !password) {
      return NextResponse.json(
        { error: "Customer number and password are required" },
        { status: 400 }
      );
    }

    const sharedPassword = process.env.CUSTOMER_PORTAL_PASSWORD;
    if (!sharedPassword) {
      return NextResponse.json({ error: "Portal not configured" }, { status: 503 });
    }

    if (password !== sharedPassword) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const customer = await db.customer.findFirst({
      where: {
        customerNumber: customerNumber.trim().toUpperCase(),
        status: "ACTIVE",
      },
      select: { id: true, customerNumber: true, name: true },
    });

    if (!customer) {
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
      secure: useSecurePortalCookie(),
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
