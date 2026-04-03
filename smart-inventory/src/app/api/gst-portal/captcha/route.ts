import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/api-auth";
import {
  getSession,
  updateSession,
  deleteSession,
  screenshotElement,
} from "@/lib/gst-portal-session";

/**
 * POST /api/gst-portal/captcha
 * Body: { sessionId, captcha }
 * Returns: { step: 'awaiting_login_otp' } on success
 *
 * Fills the captcha in the browser and submits login.
 * If captcha is wrong, returns a new captcha image to retry.
 */
export async function POST(req: NextRequest) {
  const { error } = await checkPermission("gst", "edit");
  if (error) return error;

  try {
    const { sessionId, captcha } = (await req.json()) as {
      sessionId: string;
      captcha: string;
    };

    if (!sessionId || !captcha) {
      return NextResponse.json(
        { error: "sessionId and captcha are required" },
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

    // Fill the captcha input — portal uses placeholder "Enter Characters shown below"
    const captchaInput = page.locator(
      'input[placeholder*="haracter"], input[placeholder*="captcha" i]'
    );
    await captchaInput.fill(captcha.trim());

    // Click Login again to submit with captcha
    await page.click('button:has-text("LOGIN")');

    // Wait for one of: OTP page, error message, or dashboard redirect
    const result = await Promise.race([
      // OTP input appears (successful login, awaiting OTP)
      page
        .waitForSelector('input[placeholder*="OTP" i], input[type="tel"]', {
          timeout: 15000,
        })
        .then(() => "otp_page" as const),
      // Error message (wrong captcha or invalid credentials)
      page
        .waitForSelector('.alert-danger, .error-msg, [class*="error"]', {
          timeout: 15000,
        })
        .then(() => "error" as const),
      // Dashboard redirect (login succeeded without OTP — rare but possible)
      page
        .waitForURL("**/dashboard**", { timeout: 15000 })
        .then(() => "dashboard" as const),
    ]);

    if (result === "error") {
      // Check if it's a captcha error — if so, screenshot new captcha and let user retry
      const errorText = await page
        .locator('.alert-danger, .error-msg, [class*="error"]')
        .first()
        .textContent()
        .catch(() => "");

      const isWrongCaptcha =
        errorText?.toLowerCase().includes("captcha") ||
        errorText?.toLowerCase().includes("invalid");

      if (isWrongCaptcha) {
        // Portal usually refreshes the captcha automatically
        try {
          await page.waitForSelector('img[src*="captcha"]', { timeout: 5000 });
          const captchaImage = await screenshotElement(
            page,
            'img[src*="captcha"]'
          );
          return NextResponse.json({
            error: "Wrong captcha. Try again.",
            code: "INVALID_CAPTCHA",
            captchaImage,
          });
        } catch {
          // Captcha didn't reload — return error
        }
      }

      deleteSession(sessionId);
      return NextResponse.json(
        { error: errorText || "Login failed. Check your credentials." },
        { status: 400 }
      );
    }

    if (result === "dashboard") {
      // Already logged in (no OTP needed)
      updateSession(sessionId, { step: "logged_in" });
      return NextResponse.json({ step: "logged_in" });
    }

    // OTP page — user needs to enter OTP sent to mobile
    updateSession(sessionId, { step: "awaiting_login_otp" });
    return NextResponse.json({ step: "awaiting_login_otp" });
  } catch (err) {
    console.error("[gst-portal/captcha] error:", err);
    return NextResponse.json(
      { error: "Failed to submit captcha" },
      { status: 500 }
    );
  }
}
