import { NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";

export async function GET() {
  const { error } = await checkAuth();
  if (error) return error;

  try {
    const rnd = Math.random();
    const response = await fetch(
      `https://services.gst.gov.in/services/captcha?rnd=${rnd}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://services.gst.gov.in/services/searchtp",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch captcha from GST portal" }, { status: 502 });
    }

    // Extract CaptchaCookie from Set-Cookie header
    const setCookie = response.headers.get("set-cookie") ?? "";
    const match = setCookie.match(/CaptchaCookie=([^;]+)/);
    const captchaCookie = match?.[1] ?? "";

    if (!captchaCookie) {
      return NextResponse.json({ error: "GST portal did not return a session cookie" }, { status: 502 });
    }

    // Convert PNG bytes to base64 data URL
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const captchaImage = `data:image/png;base64,${base64}`;

    return NextResponse.json({ captchaImage, captchaCookie });
  } catch (err) {
    console.error("[gstin-captcha] error:", err);
    return NextResponse.json({ error: "Could not reach GST portal" }, { status: 500 });
  }
}
