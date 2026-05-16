import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  PORTAL_COOKIE_NAME,
  PORTAL_JWT_MAX_AGE_SECONDS,
  signPortalToken,
  verifyPortalToken,
  portalCookieOptions,
} from "@/lib/portal-jwt";

export {
  PORTAL_COOKIE_NAME,
  PORTAL_JWT_MAX_AGE_SECONDS,
  signPortalToken,
  verifyPortalToken,
  portalCookieOptions,
};

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
