import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAuth } from "@/lib/api-auth";

export async function GET() {
  try {
    const { error } = await checkAuth();
    if (error) return error;

    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          link: true,
          read: true,
          createdAt: true,
        },
      }),
      db.notification.count({ where: { read: false } }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (err) {
    console.error("Error fetching notifications:", err);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { error } = await checkAuth();
    if (error) return error;

    const body = await request.json();
    const { ids } = body as { ids?: string[] };

    if (ids && ids.length > 0) {
      await db.notification.updateMany({
        where: { id: { in: ids } },
        data: { read: true },
      });
    } else {
      await db.notification.updateMany({
        where: { read: false },
        data: { read: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error marking notifications as read:", err);
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}
