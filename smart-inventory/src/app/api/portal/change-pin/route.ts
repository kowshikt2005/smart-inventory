import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPortalCustomer } from "@/lib/portal-auth";

const DEFAULT_PIN = "123456";

export async function POST(request: NextRequest) {
  const auth = await getPortalCustomer(request);
  if (auth.error) return auth.error;

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

    // Fetch the customer to verify current PIN
    const customer = await db.customer.findUnique({
      where: { id: auth.customerId },
      select: { portalPassword: true, status: true },
    });

    if (!customer || customer.status !== "ACTIVE") {
      return NextResponse.json({ error: "Account not found or inactive" }, { status: 403 });
    }

    const expectedPin = customer.portalPassword || DEFAULT_PIN;
    if (currentPin !== expectedPin) {
      return NextResponse.json({ error: "Current PIN is incorrect" }, { status: 401 });
    }

    if (newPin === currentPin) {
      return NextResponse.json(
        { error: "New PIN must be different from current PIN" },
        { status: 400 }
      );
    }

    await db.customer.update({
      where: { id: auth.customerId },
      data: { portalPassword: newPin },
    });

    return NextResponse.json({ ok: true, message: "PIN changed successfully" });
  } catch {
    return NextResponse.json({ error: "Failed to change PIN" }, { status: 500 });
  }
}
