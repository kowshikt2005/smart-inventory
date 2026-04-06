import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { deleteSession, getSession } from "@/lib/gst-portal-session";

/**
 * DELETE /api/gst-portal/cleanup
 * Body: { sessionId }
 *
 * Closes the browser session and cleans up resources.
 */
export async function DELETE(req: NextRequest) {
  const { error } = await checkAuth();
  if (error) return error;

  try {
    const { sessionId } = (await req.json()) as { sessionId: string };

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ deleted: true });
    }

    deleteSession(sessionId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[gst-portal/cleanup] error:", err);
    return NextResponse.json(
      { error: "Failed to cleanup session" },
      { status: 500 }
    );
  }
}
