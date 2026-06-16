import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/api-auth";
import { getSession, updateSession } from "@/lib/gst-portal-session";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * POST /api/gst-portal/upload
 * Body: { sessionId, govJson, month, year }
 * Returns: { step: 'uploaded' }
 *
 * After login, navigates to the Returns Dashboard, selects the period,
 * goes to GSTR-1 → Prepare Offline, and uploads the generated JSON file.
 */

// Helper: capture portal page text for debugging
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

  let tempFilePath: string | null = null;
  let stepTrace = "init";

  try {
    const { sessionId, govJson, month, year } = (await req.json()) as {
      sessionId: string;
      govJson: Record<string, unknown>;
      month: number;
      year: number;
    };

    if (!sessionId || !govJson || !month || !year) {
      return NextResponse.json(
        { error: "sessionId, govJson, month, and year are required" },
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
    if (session.step !== "logged_in") {
      return NextResponse.json(
        { error: `Cannot upload in step: ${session.step}` },
        { status: 400 }
      );
    }

    updateSession(sessionId, { step: "uploading" });
    const { page } = session;

    // ── Step 1: Navigate to Returns Dashboard ────────────────────────────
    stepTrace = "navigate_welcome";
    await page.goto(
      "https://services.gst.gov.in/services/auth/fowelcome",
      { waitUntil: "networkidle", timeout: 30000 }
    );

    stepTrace = "navigate_returns_dashboard";
    await page.goto(
      "https://return.gst.gov.in/returns/auth/dashboard",
      { waitUntil: "networkidle", timeout: 30000 }
    );

    // ── Step 2: Select Financial Year ────────────────────────────────────
    stepTrace = "select_fy_period";
    const fyStart = month >= 4 ? year : year - 1;
    const fyEnd = fyStart + 1;
    const fyString = `${fyStart}-${String(fyEnd).slice(-2)}`;

    const fyDropdown = page.locator(
      'select[name*="fy" i], select[aria-label*="Financial Year" i], select:near(:text("Financial Year"))'
    ).first();

    if (!(await fyDropdown.isVisible().catch(() => false))) {
      const info = await getPageDebugInfo(page);
      return NextResponse.json({
        error: `Could not find Financial Year dropdown on the returns dashboard.`,
        detail: `Page URL: ${info.url}. Page text: "${info.snippet}". The portal dashboard layout may have changed.`,
        step: stepTrace,
      }, { status: 502 });
    }

    const fyOptions = await fyDropdown.locator("option").allTextContents();
    const fyMatch = fyOptions.find((o) => o.includes(fyString)) || fyOptions.find((o) => o.includes(String(fyStart)));
    if (fyMatch) {
      await fyDropdown.selectOption({ label: fyMatch });
    } else {
      return NextResponse.json({
        error: `Could not find financial year "${fyString}" in dropdown. Options: [${fyOptions.join(", ")}]`,
        step: stepTrace,
      }, { status: 400 });
    }

    const monthNames = [
      "", "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const periodDropdown = page.locator(
      'select[name*="period" i], select[name*="month" i], select:near(:text("Return Filing Period"))'
    ).first();

    if (!(await periodDropdown.isVisible().catch(() => false))) {
      return NextResponse.json({
        error: "Could not find Return Filing Period dropdown on the dashboard.",
        step: stepTrace,
      }, { status: 502 });
    }

    const periodOptions = await periodDropdown.locator("option").allTextContents();
    const periodMatch = periodOptions.find((o) => o.includes(monthNames[month]));
    if (periodMatch) {
      await periodDropdown.selectOption({ label: periodMatch });
    } else {
      return NextResponse.json({
        error: `Could not find month "${monthNames[month]}" in period dropdown. Options: [${periodOptions.join(", ")}]`,
        step: stepTrace,
      }, { status: 400 });
    }

    // Click Search
    stepTrace = "click_search";
    await page.click('button:has-text("SEARCH"), button:has-text("Search")');
    await page.waitForTimeout(3000);

    // Check if portal returned any error after search (e.g., "No data found" or "already filed")
    stepTrace = "check_search_error";
    const searchError = page.locator(
      '.alert-danger, .error-msg, [class*="error"]'
    ).first();
    if (await searchError.isVisible().catch(() => false)) {
      const errText = await searchError.textContent().catch(() => "");
      if (errText?.toLowerCase().includes("already") || errText?.toLowerCase().includes("filed")) {
        // If return is already filed, the user should see this and stop.
        // We still attempt to proceed in case it's a different error.
      }
    }

    // ── Step 3: Click on GSTR-1 tile/row ─────────────────────────────────
    stepTrace = "click_gstr1_tile";
    const gstr1Link = page.locator(
      'a:has-text("GSTR-1"), button:has-text("GSTR-1"), a:has-text("Prepare Offline")'
    ).first();

    if (!(await gstr1Link.isVisible().catch(() => false))) {
      const info = await getPageDebugInfo(page);
      // Check if it's because return is already filed
      if (info.snippet.toLowerCase().includes("already filed") || info.snippet.toLowerCase().includes("return filed")) {
        return NextResponse.json({
          error: "GSTR-1 for this period is already filed on the portal. No further action needed.",
          detail: `GSTR-1 tile not available. The portal shows: "${info.snippet.substring(0, 200)}"`,
          step: stepTrace,
          alreadyFiled: true,
        }, { status: 409 });
      }
      return NextResponse.json({
        error: "Could not find GSTR-1 link on the returns dashboard.",
        detail: `Page URL: ${info.url}. Page text: "${info.snippet}". The portal dashboard layout may have changed.`,
        step: stepTrace,
      }, { status: 502 });
    }

    await gstr1Link.click();
    await page.waitForTimeout(2000);

    // Check if "Prepare Offline" button exists — click it if visible
    stepTrace = "click_prepare_offline";
    const prepareOffline = page.locator(
      'a:has-text("Prepare Offline"), button:has-text("Prepare Offline")'
    ).first();
    if (await prepareOffline.isVisible().catch(() => false)) {
      await prepareOffline.click();
      await page.waitForTimeout(2000);
    }

    // ── Step 4: Upload the JSON file ─────────────────────────────────────
    stepTrace = "write_temp_file";
    const fileName = `gstr1_${govJson.gstin || "upload"}_${govJson.fp || "temp"}.json`;
    tempFilePath = join(tmpdir(), fileName);
    writeFileSync(tempFilePath, JSON.stringify(govJson, null, 2), "utf-8");

    // Try clicking "Upload" tab if visible
    stepTrace = "click_upload_tab";
    const uploadTab = page.locator(
      'a:has-text("Upload"), button:has-text("Upload"), [role="tab"]:has-text("Upload")'
    ).first();
    if (await uploadTab.isVisible().catch(() => false)) {
      await uploadTab.click();
      await page.waitForTimeout(1000);
    }

    // Find file input
    stepTrace = "find_file_input";
    const fileInput = page.locator('input[type="file"]').first();
    if (!(await fileInput.isVisible().catch(() => false))) {
      const info = await getPageDebugInfo(page);
      return NextResponse.json({
        error: "Could not find file upload input on the GSTR-1 page.",
        detail: `Page URL: ${info.url}. Page text: "${info.snippet}". The portal may have a different upload flow.`,
        step: stepTrace,
      }, { status: 502 });
    }

    await fileInput.waitFor({ state: "attached", timeout: 10000 });
    await fileInput.setInputFiles(tempFilePath);

    // Wait for processing
    stepTrace = "wait_for_upload_processing";
    await page.waitForTimeout(5000);

    // Check for success
    stepTrace = "check_upload_result";
    const successIndicator = page.locator(
      ':text("successfully"), :text("uploaded"), :text("processed")'
    ).first();
    const hasSuccess = await successIndicator.isVisible({ timeout: 30000 }).catch(() => false);

    if (!hasSuccess) {
      const errorEl = page.locator(
        '.alert-danger, .error-msg, :text("failed"), :text("error"), :text("already filed")'
      ).first();
      const errorText = await errorEl.textContent().catch(() => "");
      if (errorText) {
        updateSession(sessionId, { step: "error", error: errorText });
        const isAlreadyFiled = errorText.toLowerCase().includes("already");
        return NextResponse.json({
          error: `Upload failed: ${errorText}`,
          step: stepTrace,
          alreadyFiled: isAlreadyFiled,
        }, { status: isAlreadyFiled ? 409 : 400 });
      }

      // No success and no error — portal likely changed
      const info = await getPageDebugInfo(page);
      return NextResponse.json({
        error: "Upload may have failed. Could not confirm success or find an error message on the portal.",
        detail: `Page URL: ${info.url}. Page text: "${info.snippet}". The portal UI may have changed.`,
        step: stepTrace,
      }, { status: 502 });
    }

    updateSession(sessionId, { step: "awaiting_evc" });
    return NextResponse.json({ step: "uploaded" });
  } catch (err: any) {
    const msg = err?.message || "";
    console.error(`[gst-portal/upload] error at step "${stepTrace}":`, msg);

    // Map Playwright error types to user-friendly messages
    if (msg.includes("net::ERR_NAME_NOT_RESOLVED") || msg.includes("net::ERR_CONNECTION_TIMED_OUT")) {
      return NextResponse.json({
        error: "Lost connection to GST portal during upload. Check your internet or AWS outbound rules.",
        detail: msg, step: stepTrace,
      }, { status: 502 });
    }
    if (msg.includes("timeout") || msg.includes("Timeout")) {
      return NextResponse.json({
        error: "GST portal timed out during upload. The portal may be slow. Try again later.",
        detail: msg, step: stepTrace,
      }, { status: 504 });
    }
    if (msg.includes("Locator") || msg.includes("NoSuchElement") || msg.includes("Unable to find")) {
      return NextResponse.json({
        error: `GST portal structure changed at step "${stepTrace}". Could not find the expected element.`,
        detail: msg, step: stepTrace,
      }, { status: 502 });
    }

    return NextResponse.json({
      error: "Failed to upload GSTR-1. The portal UI may have changed.",
      detail: msg, step: stepTrace,
    }, { status: 500 });
  } finally {
    if (tempFilePath && existsSync(tempFilePath)) {
      try { unlinkSync(tempFilePath); } catch { /* ignore */ }
    }
  }
}
