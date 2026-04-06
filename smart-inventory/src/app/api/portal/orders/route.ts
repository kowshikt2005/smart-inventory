import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPortalCustomer } from "@/lib/portal-auth";

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
    const dbItems = await db.item.findMany({
      where: { id: { in: itemIds }, isActive: true },
      select: { id: true, sellingPrice: true, gstRate: true },
    });

    if (dbItems.length !== itemIds.length) {
      return NextResponse.json({ error: "One or more items are unavailable" }, { status: 400 });
    }

    const itemMap = new Map(dbItems.map((i) => [i.id, i]));

    let subtotal = 0;
    let taxAmount = 0;

    const orderItems = items.map((cartItem) => {
      const dbItem = itemMap.get(cartItem.itemId)!;
      const rate = Number(dbItem.sellingPrice);
      const amount = rate * cartItem.quantity;
      const lineTax = (amount * Number(dbItem.gstRate)) / 100;
      subtotal += amount;
      taxAmount += lineTax;
      return {
        itemId: cartItem.itemId,
        quantity: cartItem.quantity,
        rate: dbItem.sellingPrice,
        discountPercent: 0,
        taxRate: Number(dbItem.gstRate),
        taxAmount: lineTax,
        amount,
      };
    });

    const totalAmount = subtotal + taxAmount;

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
        subtotal,
        discountAmount: 0,
        taxAmount,
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
