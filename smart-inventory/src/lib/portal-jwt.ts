import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";

export const PORTAL_COOKIE_NAME = "portal-token";
const PORTAL_TOKEN_ISSUER = "smart-inventory-portal";
const PORTAL_TOKEN_SCOPE = process.env.PORTAL_TOKEN_SCOPE || "default";

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
  return new SignJWT({
    ...payload,
    scope: PORTAL_TOKEN_SCOPE,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(PORTAL_TOKEN_ISSUER)
    .setAudience(PORTAL_TOKEN_SCOPE)
    .setExpirationTime(`${PORTAL_JWT_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyPortalToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: PORTAL_TOKEN_ISSUER,
    audience: PORTAL_TOKEN_SCOPE,
  });
  return payload as {
    customerId: string;
    customerNumber: string;
    name: string;
    scope: string;
  };
}

export function isRequestSecure(request: NextRequest): boolean {
  const proto = request.headers.get("x-forwarded-proto");
  if (proto) {
    return proto.split(",")[0].trim() === "https";
  }

  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.startsWith("https://");
  }

  try {
    if (request.nextUrl.protocol === "https:") return true;
  } catch {
    // ignore
  }
  return false;
}

export function portalCookieOptions(request: NextRequest) {
  return {
    httpOnly: true,
    secure: isRequestSecure(request),
    sameSite: "strict" as const,
    path: "/",
    maxAge: PORTAL_JWT_MAX_AGE_SECONDS,
  };
}
