import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPortalCustomer } from "@/lib/portal-auth";
import { getEffectiveRateV2 } from "@/lib/order-utils";

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

  // Fetch items and customer's rate sheet in parallel
  const [items, rateSheetJoin] = await Promise.all([
    db.item.findMany({
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
        brandId: true,
        subBrandId: true,
      },
      orderBy: { name: "asc" },
    }),
    db.rateSheetCustomer.findMany({
      where: { customerId: auth.customerId },
      include: { rateSheet: true },
      orderBy: { rateSheet: { createdAt: "desc" } },
    }),
  ]);

  // Pick the most recent rate sheet (matches admin API pattern)
  const rateSheet = rateSheetJoin.length > 0 ? rateSheetJoin[0].rateSheet : null;
  const now = new Date();
  const isEffective =
    rateSheet &&
    rateSheet.isActive &&
    rateSheet.validFrom <= now &&
    (!rateSheet.validTo || rateSheet.validTo >= now);

  // Apply rate sheet pricing to each item
  const pricedItems = items.map((item) => {
    const { rate } = isEffective
      ? getEffectiveRateV2(
          {
            id: item.id,
            mrp: item.mrp,
            sellingPrice: item.sellingPrice,
            gstRate: item.gstRate,
            brandId: item.brandId,
            subBrandId: item.subBrandId,
          },
          {
            isActive: rateSheet!.isActive,
            useInclusionModel: rateSheet!.useInclusionModel,
            discountPercent: rateSheet!.discountPercent,
            inclusionDiscounts: rateSheet!.inclusionDiscounts as Parameters<typeof getEffectiveRateV2>[1] extends { inclusionDiscounts?: infer T } ? T : never,
            excludedItemIds: (rateSheet!.excludedItemIds as string[]) ?? [],
            excludedBrandIds: (rateSheet!.excludedBrandIds as string[]) ?? [],
            excludedSubBrandIds: (rateSheet!.excludedSubBrandIds as string[]) ?? [],
          }
        )
      : { rate: Number(item.sellingPrice) };

    return {
      id: item.id,
      name: item.name,
      itemCode: item.itemCode,
      mrp: item.mrp,
      sellingPrice: rate,
      unit: item.unit,
      imageUrl: item.imageUrl,
      description: item.description,
      gstRate: item.gstRate,
    };
  });

  return NextResponse.json({ subBrand, items: pricedItems });
}
