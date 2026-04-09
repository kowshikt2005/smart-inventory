import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPortalCustomer } from "@/lib/portal-auth";
import { getEffectiveRateV2, calculateLineItemV2, calculateOrderTotals } from "@/lib/order-utils";

export async function GET(request: NextRequest) {
  const auth = await getPortalCustomer(request);
  if (auth.error) return auth.error;

  const orders = await db.salesOrder.findMany({
    where: { customerId: auth.customerId },
    select: {
      id: true,
      orderNumber: true,
      orderDate: true,
      status: true,
      totalAmount: true,
      items: {
        select: {
          quantity: true,
          rate: true,
          item: { select: { name: true, unit: true } },
        },
      },
    },
    orderBy: { orderDate: "desc" },
    take: 50,
  });

  return NextResponse.json({ orders });
}

export async function POST(request: NextRequest) {
  const auth = await getPortalCustomer(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { items, notes } = body as {
      items: { itemId: string; quantity: number }[];
      notes?: string;
    };

    if (!items?.length) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Validate quantities
    for (const item of items) {
      if (!item.itemId || item.quantity <= 0) {
        return NextResponse.json({ error: "Invalid cart items" }, { status: 400 });
      }
    }

    const itemIds = items.map((i) => i.itemId);

    // Fetch items and customer's rate sheet in parallel
    const [dbItems, rateSheetJoin] = await Promise.all([
      db.item.findMany({
        where: { id: { in: itemIds }, isActive: true },
        select: {
          id: true,
          mrp: true,
          sellingPrice: true,
          gstRate: true,
          brandId: true,
          subBrandId: true,
        },
      }),
      db.rateSheetCustomer.findMany({
        where: { customerId: auth.customerId },
        include: { rateSheet: true },
        orderBy: { rateSheet: { createdAt: "desc" } },
      }),
    ]);

    if (dbItems.length !== itemIds.length) {
      return NextResponse.json({ error: "One or more items are unavailable" }, { status: 400 });
    }

    // Pick the most recent rate sheet (matches admin API pattern)
    const rateSheet = rateSheetJoin.length > 0 ? rateSheetJoin[0].rateSheet : null;
    const now = new Date();
    const isEffective =
      rateSheet &&
      rateSheet.isActive &&
      rateSheet.validFrom <= now &&
      (!rateSheet.validTo || rateSheet.validTo >= now);

    const rateSheetParam = isEffective
      ? {
          isActive: rateSheet!.isActive,
          useInclusionModel: rateSheet!.useInclusionModel,
          discountPercent: rateSheet!.discountPercent,
          inclusionDiscounts: rateSheet!.inclusionDiscounts as Parameters<typeof getEffectiveRateV2>[1] extends { inclusionDiscounts?: infer T } ? T : never,
          excludedItemIds: (rateSheet!.excludedItemIds as string[]) ?? [],
          excludedBrandIds: (rateSheet!.excludedBrandIds as string[]) ?? [],
          excludedSubBrandIds: (rateSheet!.excludedSubBrandIds as string[]) ?? [],
        }
      : null;

    const itemMap = new Map(dbItems.map((i) => [i.id, i]));

    const orderItems = items.map((cartItem) => {
      const dbItem = itemMap.get(cartItem.itemId)!;
      const { rate, discountPercent } = getEffectiveRateV2(
        {
          id: dbItem.id,
          mrp: dbItem.mrp,
          sellingPrice: dbItem.sellingPrice,
          gstRate: dbItem.gstRate,
          brandId: dbItem.brandId,
          subBrandId: dbItem.subBrandId,
        },
        rateSheetParam
      );
      const taxRate = Number(dbItem.gstRate);
      const line = calculateLineItemV2(cartItem.quantity, rate, taxRate, discountPercent);
      return {
        itemId: cartItem.itemId,
        quantity: cartItem.quantity,
        rate,
        discountPercent,
        taxRate,
        taxAmount: line.taxAmount,
        amount: line.amount,
      };
    });

    const totals = calculateOrderTotals(orderItems);
    const totalAmount = totals.totalAmount;

    // Generate unique order number
    const lastOrder = await db.salesOrder.findFirst({
      orderBy: { createdAt: "desc" },
      select: { orderNumber: true },
    });
    const lastNum = lastOrder?.orderNumber
      ? parseInt(lastOrder.orderNumber.replace(/\D/g, ""), 10) || 0
      : 0;
    const orderNumber = `SO-${String(lastNum + 1).padStart(5, "0")}`;

    // Use first active user as portal system user
    const systemUser = await db.user.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (!systemUser) {
      return NextResponse.json({ error: "System configuration error" }, { status: 500 });
    }

    const order = await db.salesOrder.create({
      data: {
        orderNumber,
        orderDate: new Date(),
        customerId: auth.customerId,
        status: "OPEN",
        subtotal: totals.subtotal,
        discountAmount: 0,
        taxAmount: totals.totalTax,
        totalAmount,
        notes: notes || "Placed via customer portal",
        source: "CUSTOMER_PORTAL",
        createdBy: systemUser.id,
        items: {
          create: orderItems,
        },
      },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        status: true,
        orderDate: true,
      },
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    console.error("Portal order error:", err);
    return NextResponse.json({ error: "Failed to place order" }, { status: 500 });
  }
}
