import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/api-auth";
import { getSession, updateSession } from "@/lib/gst-portal-session";

/**
 * POST /api/gst-portal/login-otp
 * Body: { sessionId, otp }
 * Returns: { step: 'logged_in' }
 *
 * Fills the login OTP in the browser and verifies login.
 */
export async function POST(req: NextRequest) {
  const { error } = await checkPermission("gst", "edit");
  if (error) return error;

  try {
    const { sessionId, otp } = (await req.json()) as {
      sessionId: string;
      otp: string;
    };

    if (!sessionId || !otp) {
      return NextResponse.json(
        { error: "sessionId and otp are required" },
        { status: 400 }
      );
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session expired or not found" },
        { status: 404 }
      );
    }

    const { page } = session;

    // Fill OTP — the portal OTP input varies; try multiple selectors
    const otpInput = page.locator(
      'input[placeholder*="OTP" i], input[type="tel"], input[name*="otp" i]'
    ).first();
    await otpInput.fill(otp.trim());

    // Click the verify/submit button
    await page.click(
      'button:has-text("VERIFY"), button:has-text("VALIDATE"), button:has-text("SUBMIT")'
    );

    // Wait for dashboard or error
    const result = await Promise.race([
      page
        .waitForURL("**/dashboard**", { timeout: 20000 })
        .then(() => "dashboard" as const),
      page
        .waitForSelector('.alert-danger, .error-msg, [class*="error"]', {
          timeout: 20000,
        })
        .then(() => "error" as const),
      // Some logins redirect to the home/welcome page
      page
        .waitForURL("**/auth/fowelcome**", { timeout: 20000 })
        .then(() => "dashboard" as const),
    ]);

    if (result === "error") {
      const errorText = await page
        .locator('.alert-danger, .error-msg, [class*="error"]')
        .first()
        .textContent()
        .catch(() => "");

      return NextResponse.json(
        { error: errorText || "OTP verification failed" },
        { status: 400 }
      );
    }

    updateSession(sessionId, { step: "logged_in" });
    return NextResponse.json({ step: "logged_in" });
  } catch (err) {
    console.error("[gst-portal/login-otp] error:", err);
    return NextResponse.json(
      { error: "Failed to verify OTP" },
      { status: 500 }
    );
  }
}
