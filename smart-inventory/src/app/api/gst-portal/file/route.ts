import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/api-auth";
import { getSession, updateSession, deleteSession } from "@/lib/gst-portal-session";

/**
 * POST /api/gst-portal/file
 * Body: { sessionId, evcOtp }
 * Returns: { step: 'filed', arn }
 *
 * Submits GSTR-1, enters EVC OTP, and files the return.
 * Returns the ARN (Acknowledgement Reference Number) on success.
 */
export async function POST(req: NextRequest) {
  const { error } = await checkPermission("gst", "edit");
  if (error) return error;

  try {
    const { sessionId, evcOtp } = (await req.json()) as {
      sessionId: string;
      evcOtp: string;
    };

    if (!sessionId || !evcOtp) {
      return NextResponse.json(
        { error: "sessionId and evcOtp are required" },
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

    // ── Step 1: Click Submit GSTR-1 (if not already submitted) ──────────
    const submitBtn = page.locator(
      'button:has-text("Submit"), button:has-text("SUBMIT GSTR")'
    ).first();
    const hasSubmitBtn = await submitBtn.isVisible().catch(() => false);
    if (hasSubmitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(3000);

      // Handle confirmation dialog if any
      const confirmBtn = page.locator(
        'button:has-text("YES"), button:has-text("Proceed"), button:has-text("OK")'
      ).first();
      const hasConfirm = await confirmBtn.isVisible().catch(() => false);
      if (hasConfirm) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    // ── Step 2: Click "File GSTR-1" / "File with EVC" ───────────────────
    const fileBtn = page.locator(
      'button:has-text("FILE GSTR"), button:has-text("File with EVC"), button:has-text("FILE WITH EVC")'
    ).first();
    const hasFileBtn = await fileBtn.isVisible().catch(() => false);
    if (hasFileBtn) {
      await fileBtn.click();
      await page.waitForTimeout(2000);
    }

    // ── Step 3: Select EVC option if radio/checkbox is present ──────────
    const evcOption = page.locator(
      'input[value*="EVC" i], label:has-text("EVC"), input[name*="evc" i]'
    ).first();
    const hasEvcOption = await evcOption.isVisible().catch(() => false);
    if (hasEvcOption) {
      await evcOption.click();
      await page.waitForTimeout(1000);
    }

    // ── Step 4: Click "Generate OTP" or "Send OTP" button if visible ────
    const generateOtpBtn = page.locator(
      'button:has-text("Generate"), button:has-text("Send OTP"), button:has-text("GENERATE")'
    ).first();
    const hasGenOtp = await generateOtpBtn.isVisible().catch(() => false);
    if (hasGenOtp) {
      await generateOtpBtn.click();
      // Wait for OTP to be sent
      await page.waitForTimeout(3000);
    }

    // ── Step 5: Fill EVC OTP ─────────────────────────────────────────────
    const otpInput = page.locator(
      'input[placeholder*="OTP" i], input[type="tel"], input[name*="otp" i]'
    ).first();
    await otpInput.fill(evcOtp.trim());

    // Click the final file/submit button
    const finalFileBtn = page.locator(
      'button:has-text("FILE"), button:has-text("SUBMIT"), button:has-text("Proceed")'
    ).first();
    await finalFileBtn.click();

    // ── Step 6: Wait for ARN / success message ──────────────────────────
    await page.waitForTimeout(5000);

    // Try to extract the ARN from the success page
    const arnElement = page.locator(
      ':text("ARN"), :text("Acknowledgement"), :text("successfully filed")'
    ).first();
    await arnElement.waitFor({ state: "visible", timeout: 30000 }).catch(() => {});

    // Extract ARN number — typically shown as "ARN: ARNXXXXXXXXXX"
    const pageText = await page.locator("body").textContent().catch(() => "");
    const arnMatch = pageText?.match(/ARN[:\s]*([A-Z0-9]+)/i);
    const arn = arnMatch?.[1] || "Filed successfully";

    // Check for errors
    const errorEl = page.locator('.alert-danger, .error-msg').first();
    const hasError = await errorEl.isVisible().catch(() => false);
    if (hasError) {
      const errorText = await errorEl.textContent().catch(() => "");
      updateSession(sessionId, { step: "error", error: errorText || "Filing failed" });
      return NextResponse.json(
        { error: errorText || "Filing failed" },
        { status: 400 }
      );
    }

    updateSession(sessionId, { step: "filed", arn });

    // Clean up the browser session after successful filing
    setTimeout(() => deleteSession(sessionId), 30000);

    return NextResponse.json({ step: "filed", arn });
  } catch (err) {
    console.error("[gst-portal/file] error:", err);
    return NextResponse.json(
      { error: "Failed to file GSTR-1. The portal UI may have changed." },
      { status: 500 }
    );
  }
}
