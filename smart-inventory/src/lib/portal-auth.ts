import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const PORTAL_COOKIE_NAME = "portal-token";

const getSecret = () =>
  new TextEncoder().encode(
    process.env.PORTAL_JWT_SECRET ?? process.env.NEXTAUTH_SECRET ?? "portal-fallback-secret"
  );

export async function signPortalToken(payload: {
  customerId: string;
  customerNumber: string;
  name: string;
}) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyPortalToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as { customerId: string; customerNumber: string; name: string };
}

type PortalAuthSuccess = {
  customerId: string;
  customerNumber: string;
  name: string;
  error: null;
};
type PortalAuthFailure = {
  customerId: null;
  customerNumber: null;
  name: null;
  error: NextResponse;
};

export async function getPortalCustomer(
  request: NextRequest
): Promise<PortalAuthSuccess | PortalAuthFailure> {
  const token = request.cookies.get(PORTAL_COOKIE_NAME)?.value;
  if (!token) {
    return {
      customerId: null,
      customerNumber: null,
      name: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  try {
    const payload = await verifyPortalToken(token);

    // Verify the customer is still active in the DB
    const customer = await db.customer.findUnique({
      where: { id: payload.customerId },
      select: { status: true },
    });
    if (!customer || customer.status !== "ACTIVE") {
      return {
        customerId: null,
        customerNumber: null,
        name: null,
        error: NextResponse.json(
          { error: "Account deactivated. Please contact your sales representative." },
          { status: 403 }
        ),
      };
    }

    return { ...payload, error: null };
  } catch {
    return {
      customerId: null,
      customerNumber: null,
      name: null,
      error: NextResponse.json({ error: "Invalid or expired session" }, { status: 401 }),
    };
  }
}

export function isSecureCookie() {
  return process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;
}
