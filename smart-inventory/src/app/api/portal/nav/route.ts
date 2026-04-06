import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPortalCustomer } from "@/lib/portal-auth";

export async function GET(request: NextRequest) {
  const auth = await getPortalCustomer(request);
  if (auth.error) return auth.error;

  // Load preferred brand IDs for this customer
  const preferred = await db.customerPreferredBrand.findMany({
    where: { customerId: auth.customerId },
    select: { brandId: true },
  });

  // If customer has preferred brands set, filter to those only; otherwise show all
  const brandFilter =
    preferred.length > 0
      ? { id: { in: preferred.map((p) => p.brandId) }, isActive: true }
      : { isActive: true };

  const brands = await db.brand.findMany({
    where: brandFilter,
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
