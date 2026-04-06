import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPortalCustomer } from "@/lib/portal-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const auth = await getPortalCustomer(request);
  if (auth.error) return auth.error;

  const { brandId } = await params;

  const brand = await db.brand.findUnique({
    where: { id: brandId, isActive: true },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      discountPercent: true,
      subBrands: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          discountPercent: true,
          _count: {
            select: { items: { where: { isActive: true } } },
          },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  return NextResponse.json({ brand });
}
