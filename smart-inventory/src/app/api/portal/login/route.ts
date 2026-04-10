import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signPortalToken, PORTAL_COOKIE_NAME, portalCookieOptions } from "@/lib/portal-auth";
import { verifyPassword } from "@/lib/auth-utils";
import { cache } from "@/lib/cache";

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_SECONDS = 900; // 15 minutes
const PORTAL_LOGIN_PREFIX = "portal_login:";

/** Extract last 10 digits — strips country codes (+91, 91, etc.) */
function extractLast10(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** Normalize phone for exact DB lookup: +91XXXXXXXXXX */
function normalizePhone(phone: string): string {
  const last10 = extractLast10(phone);
  return `+91${last10}`;
}

function getRateLimitKey(phone: string): string {
  return `${PORTAL_LOGIN_PREFIX}${extractLast10(phone)}`;
}

function checkRateLimit(key: string): string | null {
  const attempts = cache.get<number>(key) ?? 0;
  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    return "Too many login attempts. Please try again in 15 minutes.";
  }
  return null;
}

function recordFailedAttempt(key: string): void {
  const attempts = (cache.get<number>(key) ?? 0) + 1;
  cache.set(key, attempts, LOGIN_LOCKOUT_SECONDS);
}

function clearAttempts(key: string): void {
  cache.delete(key);
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

    const last10 = extractLast10(phone.trim());
    if (last10.length < 10) {
      return NextResponse.json(
        { error: "Please enter a valid 10-digit phone number" },
        { status: 400 }
      );
    }

    const rateLimitKey = getRateLimitKey(phone.trim());
    const rateLimitError = checkRateLimit(rateLimitKey);
    if (rateLimitError) {
      return NextResponse.json({ error: rateLimitError }, { status: 429 });
    }

    // Try exact normalized match first (+91XXXXXXXXXX), then plain 10-digit fallback.
    // This avoids LIKE '%...' which could match multiple rows.
    const normalized = normalizePhone(phone.trim());
    let customer = await db.customer.findFirst({
      where: { phone: normalized },
      select: {
        id: true,
        customerNumber: true,
        name: true,
        portalPassword: true,
        status: true,
      },
    });

    // Fallback: stored as plain 10 digits (no country code)
    if (!customer) {
      customer = await db.customer.findFirst({
        where: { phone: last10 },
        select: {
          id: true,
          customerNumber: true,
          name: true,
          portalPassword: true,
          status: true,
        },
      });
    }

    if (!customer) {
      recordFailedAttempt(rateLimitKey);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (customer.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Your account has been deactivated. Please contact your sales representative." },
        { status: 403 }
      );
    }

    // No PIN set — allow first-time default "123456"
    if (!customer.portalPassword) {
      if (pin !== "123456") {
        recordFailedAttempt(rateLimitKey);
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }
    } else {
      // Verify bcrypt hash
      const isValid = await verifyPassword(pin, customer.portalPassword);
      if (!isValid) {
        recordFailedAttempt(rateLimitKey);
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }
    }

    clearAttempts(rateLimitKey);

    const token = await signPortalToken({
      customerId: customer.id,
      customerNumber: customer.customerNumber,
      name: customer.name,
    });

    const response = NextResponse.json({
      ok: true,
      customer: { name: customer.name, customerNumber: customer.customerNumber },
    });

    response.cookies.set(PORTAL_COOKIE_NAME, token, portalCookieOptions(request));

    return response;
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
