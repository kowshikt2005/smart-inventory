import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const PORTAL_COOKIE_NAME = "portal-token";

// Portal JWT lifetime — kept short so that a stolen token has a tight replay window.
// If you lengthen this, consider adding server-side revocation.
export const PORTAL_JWT_MAX_AGE_SECONDS = 24 * 60 * 60; // 1 day

let cachedSecret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const secret = process.env.PORTAL_JWT_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error(
      "PORTAL_JWT_SECRET (or NEXTAUTH_SECRET fallback) must be set to a strong random value (>=16 chars)"
    );
  }
  cachedSecret = new TextEncoder().encode(secret);
  return cachedSecret;
}

export async function signPortalToken(payload: {
  customerId: string;
  customerNumber: string;
  name: string;
}) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PORTAL_JWT_MAX_AGE_SECONDS}s`)
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

/**
 * Determine whether the current request is being served over HTTPS.
 *
 * Behind a TLS-terminating proxy (nginx, CloudFront, ALB) the request reaches
 * the app over plain HTTP but the original client-facing leg is HTTPS. We
 * trust `x-forwarded-proto` set by the proxy. Falls back to the raw URL and
 * finally the NEXTAUTH_URL env var.
 */
export function isRequestSecure(request: NextRequest): boolean {
  const proto = request.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  try {
    if (request.nextUrl.protocol === "https:") return true;
  } catch {
    // ignore
  }
  return process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;
}

/**
 * Standard cookie options for the portal session cookie.
 * Use on both set (login) and delete (logout) so flags match.
 */
export function portalCookieOptions(request: NextRequest) {
  return {
    httpOnly: true,
    secure: isRequestSecure(request),
    sameSite: "strict" as const,
    path: "/",
    maxAge: PORTAL_JWT_MAX_AGE_SECONDS,
  };
}
