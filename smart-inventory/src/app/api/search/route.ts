import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkPermission } from "@/lib/api-auth";

const SEARCH_LIMIT_MAX = 20;
const SEARCH_LIMIT_DEFAULT = 5;

export async function GET(request: NextRequest) {
  try {
    const { error } = await checkPermission('reports', 'view');
    if (error) return error;

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const requestedLimit = Number.parseInt(searchParams.get("limit") || `${SEARCH_LIMIT_DEFAULT}`, 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(SEARCH_LIMIT_MAX, Math.max(1, requestedLimit))
      : SEARCH_LIMIT_DEFAULT;

    if (!query || query.length < 2) {
      return NextResponse.json({
        customers: [],
        vendors: [],
        items: [],
        salesOrders: [],
        journals: [],
      });
    }

    // Run all searches in parallel on the server side
    const [customers, vendors, items, salesOrders, journals] = await Promise.all([
      // Customers search
      db.customer.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { customerNumber: { contains: query } },
            { email: { contains: query } },
            { phone: { contains: query } },
            { gstin: { contains: query } },
          ],
        },
        select: {
          id: true,
          name: true,
          customerNumber: true,
          email: true,
          phone: true,
          city: true,
          state: true,
          gstin: true,
        },
        take: limit,
        orderBy: { name: "asc" },
      }),

      // Vendors search
      db.vendor.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { vendorNumber: { contains: query } },
            { email: { contains: query } },
            { phone: { contains: query } },
            { gstin: { contains: query } },
          ],
        },
        select: {
          id: true,
          name: true,
          vendorNumber: true,
          email: true,
          phone: true,
          city: true,
          state: true,
          gstin: true,
        },
        take: limit,
        orderBy: { name: "asc" },
      }),

      // Items search
      db.item.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { itemCode: { contains: query } },
            { description: { contains: query } },
          ],
        },
        select: {
          id: true,
          name: true,
          itemCode: true,
          description: true,
          unit: true,
          sellingPrice: true,
          brand: { select: { name: true } },
          subBrand: { select: { name: true } },
          inventory: { select: { physicalStock: true } },
        },
        take: limit,
        orderBy: { name: "asc" },
      }),

      // Sales Orders search
      db.salesOrder.findMany({
        where: {
          OR: [
            { orderNumber: { contains: query } },
            { customer: { name: { contains: query } } },
          ],
        },
        select: {
          id: true,
          orderNumber: true,
          orderDate: true,
          totalAmount: true,
          status: true,
          customer: { select: { name: true } },
        },
        take: limit,
        orderBy: { orderDate: "desc" },
      }),

      // Stock Journals search
      db.stockJournal.findMany({
        where: {
          OR: [
            { journalNumber: { contains: query } },
            { reason: { contains: query } },
          ],
        },
        select: {
          id: true,
          journalNumber: true,
          date: true,
          type: true,
          quantity: true,
          reason: true,
          itemId: true,
        },
        take: limit,
        orderBy: { date: "desc" },
      }),
    ]);

    // Fetch item details for journal results (StockJournal has no item relation)
    const journalItemIds = journals.map(j => j.itemId);
    const journalItems = journalItemIds.length > 0
      ? await db.item.findMany({
          where: { id: { in: journalItemIds } },
          select: { id: true, name: true, unit: true },
        })
      : [];
    const journalItemMap = new Map(journalItems.map(i => [i.id, i]));

    return NextResponse.json({
      customers,
      vendors,
      items,
      salesOrders,
      journals: journals.map(j => ({
        ...j,
        item: journalItemMap.get(j.itemId) || null,
      })),
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to perform search" },
      { status: 500 }
    );
  }
}
