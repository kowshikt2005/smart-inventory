import { NextResponse } from "next/server";
import { checkPermission } from "@/lib/api-auth";
import { sendTextMessage } from "@/lib/whatsapp";

export async function POST(request: Request) {
  try {
    const { error } = await checkPermission("masters_employees", "edit");
    if (error) return error;

    const body = await request.json();
    const { phone, name, email, password } = body;

    if (!phone || !name || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields: phone, name, email, password" },
        { status: 400 }
      );
    }

    const message = `Hi ${name},

Your account has been created. Here are your login credentials:

Email: ${email}
Password: ${password}

Please login and change your password after first login.`;

    const result = await sendTextMessage(phone, message);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send WhatsApp message" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error("Error sending credentials via WhatsApp:", error);
    return NextResponse.json(
      { error: "Failed to send credentials" },
      { status: 500 }
    );
  }
}
