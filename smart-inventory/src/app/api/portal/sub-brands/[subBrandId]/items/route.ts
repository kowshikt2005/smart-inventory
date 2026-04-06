import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPortalCustomer } from "@/lib/portal-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subBrandId: string }> }
) {
  const auth = await getPortalCustomer(request);
  if (auth.error) return auth.error;

  const { subBrandId } = await params;

  const subBrand = await db.subBrand.findUnique({
    where: { id: subBrandId, isActive: true },
    select: { id: true, name: true, brandId: true, discountPercent: true },
  });

  if (!subBrand) {
    return NextResponse.json({ error: "Sub-brand not found" }, { status: 404 });
  }

  const items = await db.item.findMany({
    where: { subBrandId, isActive: true },
    select: {
      id: true,
      name: true,
      itemCode: true,
      mrp: true,
      sellingPrice: true,
      unit: true,
      imageUrl: true,
      description: true,
      gstRate: true,
      inventory: {
        select: { physicalStock: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ subBrand, items });
}
