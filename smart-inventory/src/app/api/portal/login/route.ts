import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signPortalToken, PORTAL_COOKIE_NAME, portalCookieOptions } from "@/lib/portal-auth";
import { hashPassword, verifyPassword } from "@/lib/auth-utils";
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

function isBcryptHash(value: string): boolean {
  return value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$");
}

/**
 * Pick the best matching customer for a phone by scoring canonical matches.
 * This avoids accidental matches when multiple records include the same suffix.
 */
function pickBestCustomerMatch<T extends { phone: string | null }>(
  customers: T[],
  inputPhone: string,
  last10: string,
  normalized: string
): T | null {
  const inputDigits = inputPhone.replace(/\D/g, "");

  const ranked = customers
    .map((customer) => {
      const storedPhone = customer.phone ?? "";
      const storedDigits = storedPhone.replace(/\D/g, "");
      const storedLast10 = extractLast10(storedPhone);

      let score = 0;
      if (storedPhone === normalized) score += 100;
      if (storedPhone === last10) score += 90;
      if (storedDigits === inputDigits) score += 80;
      if (storedLast10 === last10) score += 70;
      if (storedPhone.endsWith(last10)) score += 20;

      return { customer, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return null;
  return ranked[0].customer;
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

    // Fetch potential matches and pick the strongest canonical match.
    // This handles stored formats like "+91-XXXXXXXXXX" while avoiding random suffix collisions.
    const normalized = normalizePhone(phone.trim());
    const candidates = await db.customer.findMany({
      where: {
        OR: [
          { phone: normalized },
          { phone: last10 },
          { phone: { contains: last10 } },
          { phone: { endsWith: last10 } },
        ],
      },
      select: {
        id: true,
        customerNumber: true,
        name: true,
        phone: true,
        portalPassword: true,
        status: true,
      },
      take: 25,
    });

    const customer = pickBestCustomerMatch(candidates, phone.trim(), last10, normalized);

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
      let isValid = false;
      if (isBcryptHash(customer.portalPassword)) {
        isValid = await verifyPassword(pin, customer.portalPassword);
      } else {
        // Backward compatibility: legacy plaintext PINs from old data.
        isValid = pin === customer.portalPassword;
        if (isValid) {
          // Opportunistically upgrade legacy plaintext to bcrypt.
          await db.customer.update({
            where: { id: customer.id },
            data: { portalPassword: await hashPassword(pin) },
          });
        }
      }

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
      isDefaultPin: !customer.portalPassword,
      customer: { name: customer.name, customerNumber: customer.customerNumber },
    });

    response.cookies.set(PORTAL_COOKIE_NAME, token, portalCookieOptions(request));

    return response;
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
