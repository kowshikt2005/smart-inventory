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

async function getPageDebugInfo(page: any): Promise<{ url: string; snippet: string }> {
  try {
    const url = page.url();
    const text = await page.locator("body").textContent().catch(() => "");
    const snippet = text ? text.substring(0, 300).replace(/\s+/g, " ").trim() : "";
    return { url, snippet };
  } catch {
    return { url: "unknown", snippet: "" };
  }
}

export async function POST(req: NextRequest) {
  const { error } = await checkPermission("gst", "edit");
  if (error) return error;

  let stepTrace = "init";

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
    stepTrace = "click_submit_gstr1";
    const submitBtn = page.locator(
      'button:has-text("Submit"), button:has-text("SUBMIT GSTR")'
    ).first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(3000);

      // Handle confirmation dialog if any
      stepTrace = "handle_submit_confirm";
      const confirmBtn = page.locator(
        'button:has-text("YES"), button:has-text("Proceed"), button:has-text("OK")'
      ).first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    // ── Step 2: Click "File GSTR-1" / "File with EVC" ───────────────────
    stepTrace = "click_file_button";
    const fileBtn = page.locator(
      'button:has-text("FILE GSTR"), button:has-text("File with EVC"), button:has-text("FILE WITH EVC")'
    ).first();
    let hasFileBtn = false;
    try { hasFileBtn = await fileBtn.isVisible(); } catch { /* ignore */ }
    if (hasFileBtn) {
      await fileBtn.click();
      await page.waitForTimeout(2000);
    } else {
      // If no file button is visible, check the page state
      const info = await getPageDebugInfo(page);
      if (info.snippet.toLowerCase().includes("already filed") || info.snippet.toLowerCase().includes("already")) {
        return NextResponse.json({
          error: "GSTR-1 for this period is already filed on the portal.",
          detail: `Could not find file button. Portal says: "${info.snippet.substring(0, 200)}"`,
          step: stepTrace,
          alreadyFiled: true,
        }, { status: 409 });
      }
      return NextResponse.json({
        error: "Could not find \"File GSTR-1\" button on the portal.",
        detail: `Page URL: ${info.url}. Page text: "${info.snippet}". The portal filing page may have changed.`,
        step: stepTrace,
      }, { status: 502 });
    }

    // ── Step 3: Select EVC option if radio/checkbox is present ──────────
    stepTrace = "select_evc_option";
    const evcOption = page.locator(
      'input[value*="EVC" i], label:has-text("EVC"), input[name*="evc" i]'
    ).first();
    if (await evcOption.isVisible().catch(() => false)) {
      await evcOption.click();
      await page.waitForTimeout(1000);
    }

    // ── Step 4: Click "Generate OTP" or "Send OTP" button if visible ────
    stepTrace = "generate_evc_otp";
    const generateOtpBtn = page.locator(
      'button:has-text("Generate"), button:has-text("Send OTP"), button:has-text("GENERATE")'
    ).first();
    if (await generateOtpBtn.isVisible().catch(() => false)) {
      await generateOtpBtn.click();
      // Wait for OTP to be sent
      await page.waitForTimeout(3000);
    }

    // ── Step 5: Fill EVC OTP ─────────────────────────────────────────────
    stepTrace = "fill_evc_otp";
    const otpInput = page.locator(
      'input[placeholder*="OTP" i], input[type="tel"], input[name*="otp" i]'
    ).first();
    if (!(await otpInput.isVisible().catch(() => false))) {
      return NextResponse.json({
        error: "Could not find EVC OTP input field on the portal.",
        step: stepTrace,
      }, { status: 502 });
    }
    await otpInput.fill(evcOtp.trim());

    // Click the final file/submit button
    stepTrace = "click_final_file";
    const finalFileBtn = page.locator(
      'button:has-text("FILE"), button:has-text("SUBMIT"), button:has-text("Proceed")'
    ).first();
    if (!(await finalFileBtn.isVisible().catch(() => false))) {
      return NextResponse.json({
        error: "Could not find the final \"File\" or \"Submit\" button after entering EVC OTP.",
        step: stepTrace,
      }, { status: 502 });
    }
    await finalFileBtn.click();

    // ── Step 6: Wait for ARN / success message ──────────────────────────
    stepTrace = "wait_for_filing_result";
    await page.waitForTimeout(5000);

    // Try to extract the ARN from the success page
    const arnElement = page.locator(
      ':text("ARN"), :text("Acknowledgement"), :text("successfully filed")'
    ).first();
    try {
      await arnElement.waitFor({ state: "visible", timeout: 30000 });
    } catch {
      // ARN element not found — may be an error page
    }

    // Extract ARN number
    const pageText = await page.locator("body").textContent().catch(() => "");
    const arnMatch = pageText?.match(/ARN[:\s]*([A-Z0-9]+)/i);
    const arn = arnMatch?.[1] || null;

    // Check for errors on the page
    stepTrace = "check_filing_error";
    const errorEl = page.locator('.alert-danger, .error-msg').first();
    if (await errorEl.isVisible().catch(() => false)) {
      const errorText = await errorEl.textContent().catch(() => "");
      updateSession(sessionId, { step: "error", error: errorText || "Filing failed" });

      if (errorText?.toLowerCase().includes("already filed")) {
        return NextResponse.json({
          error: "GSTR-1 is already filed for this period. Nothing to do.",
          detail: errorText,
          step: stepTrace,
          alreadyFiled: true,
        }, { status: 409 });
      }

      return NextResponse.json({
        error: errorText || "Filing was rejected by the GST portal.",
        detail: "", step: stepTrace,
      }, { status: 400 });
    }

    if (!arn) {
      // No ARN found and no error — check page state
      const info = await getPageDebugInfo(page);
      if (info.snippet.toLowerCase().includes("successfully") || info.snippet.toLowerCase().includes("filed")) {
        // Filing likely succeeded but ARN not extracted
        updateSession(sessionId, { step: "filed", arn: "Filed successfully" });
        setTimeout(() => deleteSession(sessionId), 30000);
        return NextResponse.json({ step: "filed", arn: "Filed (ARN not found on page)" });
      }
      return NextResponse.json({
        error: "Filing completed but we could not confirm success. Manual verification recommended.",
        detail: `Page text: "${info.snippet.substring(0, 200)}"`,
        step: stepTrace,
      }, { status: 200 });
    }

    updateSession(sessionId, { step: "filed", arn });

    // Clean up the browser session after successful filing
    setTimeout(() => deleteSession(sessionId), 30000);

    return NextResponse.json({ step: "filed", arn });
  } catch (err: any) {
    const msg = err?.message || "";
    console.error(`[gst-portal/file] error at step "${stepTrace}":`, msg);

    if (msg.includes("net::ERR_CONNECTION") || msg.includes("net::ERR_NAME_NOT_RESOLVED")) {
      return NextResponse.json({
        error: "Lost connection to GST portal during filing.",
        detail: msg, step: stepTrace,
      }, { status: 502 });
    }
    if (msg.includes("timeout") || msg.includes("Timeout")) {
      return NextResponse.json({
        error: "GST portal timed out during filing. The portal may be slow.",
        detail: msg, step: stepTrace,
      }, { status: 504 });
    }
    if (msg.includes("Locator") || msg.includes("NoSuchElement")) {
      return NextResponse.json({
        error: `GST portal structure changed at step "${stepTrace}". Could not find the expected button or field.`,
        detail: msg, step: stepTrace,
      }, { status: 502 });
    }

    return NextResponse.json({
      error: "Failed to file GSTR-1. The portal UI may have changed.",
      detail: msg, step: stepTrace,
    }, { status: 500 });
  }
}
