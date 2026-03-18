import { NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";

// GET /api/email-recipients — list all saved recipients
export async function GET() {
  const { error } = await checkAuth();
  if (error) return error;

  const recipients = await db.emailRecipient.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ recipients });
}

// POST /api/email-recipients — add a new recipient
export async function POST(req: Request) {
  const { error } = await checkAuth();
  if (error) return error;

  const body = await req.json();
  const { email, name } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const existing = await db.emailRecipient.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  // First recipient automatically becomes the default
  const count = await db.emailRecipient.count();
  const recipient = await db.emailRecipient.create({
    data: {
      email,
      name: name?.trim() || null,
      isDefault: count === 0,
    },
  });

  return NextResponse.json({ recipient }, { status: 201 });
}
