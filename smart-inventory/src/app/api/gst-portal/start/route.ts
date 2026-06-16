import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/api-auth";
import {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  screenshotElement,
} from "@/lib/gst-portal-session";

/**
 * POST /api/gst-portal/start
 * Body: { username, password }
 * Returns: { sessionId, captchaImage }
 *
 * Opens a headless browser, navigates to the GST portal login page,
 * fills username + password, clicks Login, waits for captcha to appear,
 * screenshots the captcha image and returns it as a data URL.
 */
export async function POST(req: NextRequest) {
  const { error } = await checkPermission("gst", "edit");
  if (error) return error;

  let sessionId: string | null = null;

  try {
    const { username, password } = (await req.json()) as {
      username: string;
      password: string;
    };

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Launch browser and navigate to login
    sessionId = await createSession();
    const session = getSession(sessionId)!;
    const { page } = session;

    await page.goto("https://services.gst.gov.in/services/login", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Fill credentials
    await page.fill("#username", username);
    await page.fill("#user_pass", password);

    // Click Login — this reveals the captcha
    await page.click('button:has-text("LOGIN")');

    // Wait for captcha image to appear
    await page.waitForSelector('img[src*="captcha"]', { timeout: 15000 });

    // Screenshot the captcha image element
    const captchaImage = await screenshotElement(page, 'img[src*="captcha"]');

    updateSession(sessionId, { step: "awaiting_captcha" });

    return NextResponse.json({ sessionId, captchaImage });
  } catch (err: any) {
    console.error("[gst-portal/start] error:", err);
    if (sessionId) deleteSession(sessionId);

    const msg = err?.message || "";
    if (msg.includes("net::ERR_NAME_NOT_RESOLVED") || msg.includes("net::ERR_CONNECTION_REFUSED") || msg.includes("net::ERR_CONNECTION_TIMED_OUT")) {
      return NextResponse.json({ error: "Cannot reach GST portal (services.gst.gov.in). Check your internet connection or AWS outbound rules.", detail: msg }, { status: 502 });
    }
    if (msg.includes("net::ERR_SSL") || msg.includes("certificate")) {
      return NextResponse.json({ error: "SSL error connecting to GST portal. Possible network/proxy issue.", detail: msg }, { status: 502 });
    }
    if (msg.includes("waitForSelector") || msg.includes("captcha")) {
      return NextResponse.json({ error: "GST portal did not show captcha after login. The portal UI may have changed or credentials were rejected immediately.", detail: msg }, { status: 502 });
    }
    if (msg.includes("fill") || msg.includes("click") || msg.includes("Locator")) {
      return NextResponse.json({ error: "GST portal login page structure changed. Could not find username/password fields.", detail: msg }, { status: 502 });
    }
    if (msg.includes("timeout") || msg.includes("Timeout")) {
      return NextResponse.json({ error: "GST portal timed out. The portal may be slow or unreachable.", detail: msg }, { status: 504 });
    }

    return NextResponse.json(
      { error: "Failed to connect to GST portal", detail: msg },
      { status: 500 }
    );
  }
}
