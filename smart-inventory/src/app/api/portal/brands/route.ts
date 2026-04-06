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
      discountPercent: true,
      _count: {
        select: { subBrands: { where: { isActive: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ brands });
}
