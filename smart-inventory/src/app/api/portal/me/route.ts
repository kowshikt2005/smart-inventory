import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPortalCustomer } from "@/lib/portal-auth";

export async function GET(request: NextRequest) {
  const auth = await getPortalCustomer(request);
  if (auth.error) return auth.error;

  const customer = await db.customer.findUnique({
    where: { id: auth.customerId },
    select: {
      id: true,
      customerNumber: true,
      name: true,
      email: true,
      phone: true,
      city: true,
      state: true,
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  return NextResponse.json({ customer });
}
