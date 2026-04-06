import { NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";

// PATCH /api/email-recipients/[id] — set as default or update name
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await checkAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { isDefault, name } = body;

  const existing = await db.emailRecipient.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
  }

  // If setting as default, unset all others first
  if (isDefault === true) {
    await db.emailRecipient.updateMany({ data: { isDefault: false } });
  }

  const recipient = await db.emailRecipient.update({
    where: { id },
    data: {
      ...(isDefault !== undefined ? { isDefault } : {}),
      ...(name !== undefined ? { name: name?.trim() || null } : {}),
    },
  });

  return NextResponse.json({ recipient });
}

// DELETE /api/email-recipients/[id] — remove a recipient
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await checkAuth();
  if (error) return error;

  const { id } = await params;

  const existing = await db.emailRecipient.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
  }

  await db.emailRecipient.delete({ where: { id } });

  // If the deleted recipient was the default, promote the next one
  if (existing.isDefault) {
    const next = await db.emailRecipient.findFirst({ orderBy: { createdAt: "asc" } });
    if (next) {
      await db.emailRecipient.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }

  return NextResponse.json({ success: true });
}
