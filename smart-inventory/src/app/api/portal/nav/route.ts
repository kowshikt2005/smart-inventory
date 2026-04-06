import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPortalCustomer } from "@/lib/portal-auth";

export async function GET(request: NextRequest) {
  const auth = await getPortalCustomer(request);
  if (auth.error) return auth.error;

  const brands = await db.brand.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      subBrands: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          _count: { select: { items: { where: { isActive: true } } } },
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ brands });
}
