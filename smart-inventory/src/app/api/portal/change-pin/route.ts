import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPortalCustomer, signPortalToken, PORTAL_COOKIE_NAME, portalCookieOptions } from "@/lib/portal-auth";
import { hashPassword, verifyPassword } from "@/lib/auth-utils";
import { cache } from "@/lib/cache";

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 900; // 15 minutes
const CHANGE_PIN_PREFIX = "portal_changepin:";

function getRateLimitKey(customerId: string): string {
  return `${CHANGE_PIN_PREFIX}${customerId}`;
}

function checkRateLimit(key: string): string | null {
  const attempts = cache.get<number>(key) ?? 0;
  if (attempts >= MAX_ATTEMPTS) {
    return "Too many attempts. Please try again in 15 minutes.";
  }
  return null;
}

function recordFailed(key: string): void {
  const attempts = (cache.get<number>(key) ?? 0) + 1;
  cache.set(key, attempts, LOCKOUT_SECONDS);
}

function clearAttempts(key: string): void {
  cache.delete(key);
}

function isBcryptHash(value: string): boolean {
  return value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$");
}

export async function POST(request: NextRequest) {
  const auth = await getPortalCustomer(request);
  if (auth.error) return auth.error;

  const rateLimitKey = getRateLimitKey(auth.customerId);
  const rateLimitError = checkRateLimit(rateLimitKey);
  if (rateLimitError) {
    return NextResponse.json({ error: rateLimitError }, { status: 429 });
  }

  try {
    const { currentPin, newPin } = (await request.json()) as {
      currentPin: string;
      newPin: string;
    };

    if (!currentPin || !newPin) {
      return NextResponse.json(
        { error: "Current PIN and new PIN are required" },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(newPin)) {
      return NextResponse.json(
        { error: "New PIN must be exactly 6 digits" },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(currentPin)) {
      return NextResponse.json(
        { error: "Current PIN must be exactly 6 digits" },
        { status: 400 }
      );
    }

    const customer = await db.customer.findUnique({
      where: { id: auth.customerId },
      select: { portalPassword: true, status: true, customerNumber: true, name: true },
    });

    if (!customer || customer.status !== "ACTIVE") {
      return NextResponse.json({ error: "Account not found or inactive" }, { status: 403 });
    }

    if (!customer.portalPassword) {
      // No PIN set — customer is on the default "123456". Verify that was provided.
      if (currentPin !== "123456") {
        recordFailed(rateLimitKey);
        return NextResponse.json({ error: "Current PIN is incorrect" }, { status: 401 });
      }
      // Prevent setting the default as the new PIN
      if (newPin === "123456") {
        return NextResponse.json({ error: "Please choose a PIN different from the default" }, { status: 400 });
      }
    } else {
      const isCurrentValid = isBcryptHash(customer.portalPassword)
        ? await verifyPassword(currentPin, customer.portalPassword)
        : currentPin === customer.portalPassword;
      if (!isCurrentValid) {
        recordFailed(rateLimitKey);
        return NextResponse.json({ error: "Current PIN is incorrect" }, { status: 401 });
      }

      // Prevent reuse of current PIN
      const isSame = isBcryptHash(customer.portalPassword)
        ? await verifyPassword(newPin, customer.portalPassword)
        : newPin === customer.portalPassword;
      if (isSame) {
        return NextResponse.json(
          { error: "New PIN must be different from current PIN" },
          { status: 400 }
        );
      }
    }

    clearAttempts(rateLimitKey);

    const newHash = await hashPassword(newPin);
    await db.customer.update({
      where: { id: auth.customerId },
      data: { portalPassword: newHash },
    });

    // Re-issue JWT so the new session is fresh (old tokens remain valid until
    // they naturally expire, but this closes the window for session fixation)
    const newToken = await signPortalToken({
      customerId: auth.customerId,
      customerNumber: auth.customerNumber,
      name: auth.name,
    });

    const response = NextResponse.json({ ok: true, message: "PIN changed successfully" });
    response.cookies.set(PORTAL_COOKIE_NAME, newToken, portalCookieOptions(request));

    return response;
  } catch {
    return NextResponse.json({ error: "Failed to change PIN" }, { status: 500 });
  }
}
