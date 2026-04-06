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
export async function POST(req: NextRequest) {
  const { error } = await checkPermission("gst", "edit");
  if (error) return error;

  let tempFilePath: string | null = null;

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
    await page.goto(
      "https://services.gst.gov.in/services/auth/fowelcome",
      { waitUntil: "networkidle", timeout: 30000 }
    );

    // Click "Returns Dashboard" from the Services menu or navigate directly
    // Try direct URL first (more reliable than clicking menus)
    await page.goto(
      "https://return.gst.gov.in/returns/auth/dashboard",
      { waitUntil: "networkidle", timeout: 30000 }
    );

    // ── Step 2: Select Financial Year ────────────────────────────────────
    // Determine the financial year from the month/year
    // FY runs Apr-Mar. If month >= 4, FY is year-year+1. Otherwise year-1-year.
    const fyStart = month >= 4 ? year : year - 1;
    const fyEnd = fyStart + 1;
    const fyString = `${fyStart}-${String(fyEnd).slice(-2)}`; // e.g. "2025-26"

    // Select FY dropdown
    const fyDropdown = page.locator(
      'select[name*="fy" i], select[aria-label*="Financial Year" i], select:near(:text("Financial Year"))'
    ).first();
    // Find the matching option by text content, since selectOption needs exact strings
    const fyOptions = await fyDropdown.locator("option").allTextContents();
    const fyMatch = fyOptions.find((o) => o.includes(fyString)) || fyOptions.find((o) => o.includes(String(fyStart)));
    if (fyMatch) {
      await fyDropdown.selectOption({ label: fyMatch });
    }

    // Select return filing period (month name)
    const monthNames = [
      "", "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const periodDropdown = page.locator(
      'select[name*="period" i], select[name*="month" i], select:near(:text("Return Filing Period"))'
    ).first();
    const periodOptions = await periodDropdown.locator("option").allTextContents();
    const periodMatch = periodOptions.find((o) => o.includes(monthNames[month]));
    if (periodMatch) {
      await periodDropdown.selectOption({ label: periodMatch });
    }

    // Click Search
    await page.click('button:has-text("SEARCH"), button:has-text("Search")');
    await page.waitForTimeout(3000);

    // ── Step 3: Click on GSTR-1 tile/row → Prepare Offline ──────────────
    // The dashboard shows tiles or a table. Look for GSTR-1 link.
    const gstr1Link = page.locator(
      'a:has-text("GSTR-1"), button:has-text("GSTR-1"), a:has-text("Prepare Offline")'
    ).first();
    await gstr1Link.click();
    await page.waitForTimeout(2000);

    // If we landed on a GSTR-1 overview page, click "Prepare Offline"
    const prepareOffline = page.locator(
      'a:has-text("Prepare Offline"), button:has-text("Prepare Offline")'
    ).first();
    const hasOfflineButton = await prepareOffline.isVisible().catch(() => false);
    if (hasOfflineButton) {
      await prepareOffline.click();
      await page.waitForTimeout(2000);
    }

    // ── Step 4: Upload the JSON file ─────────────────────────────────────
    // Write govJson to a temp file
    const fileName = `gstr1_${govJson.gstin || "upload"}_${govJson.fp || "temp"}.json`;
    tempFilePath = join(tmpdir(), fileName);
    writeFileSync(tempFilePath, JSON.stringify(govJson, null, 2), "utf-8");

    // Look for a file upload input or "Choose File" button
    // Try clicking any "Upload" tab or button first
    const uploadTab = page.locator(
      'a:has-text("Upload"), button:has-text("Upload"), [role="tab"]:has-text("Upload")'
    ).first();
    const hasUploadTab = await uploadTab.isVisible().catch(() => false);
    if (hasUploadTab) {
      await uploadTab.click();
      await page.waitForTimeout(1000);
    }

    // Find the file input and upload
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.waitFor({ state: "attached", timeout: 10000 });
    await fileInput.setInputFiles(tempFilePath);

    // Wait for processing — the portal usually shows a progress bar or status message
    await page.waitForTimeout(5000);

    // Look for success indication
    const successIndicator = page.locator(
      ':text("successfully"), :text("uploaded"), :text("processed")'
    ).first();
    const hasSuccess = await successIndicator.isVisible({ timeout: 30000 }).catch(() => false);

    if (!hasSuccess) {
      // Check for error
      const errorEl = page.locator(
        '.alert-danger, .error-msg, :text("failed"), :text("error")'
      ).first();
      const errorText = await errorEl.textContent().catch(() => "");
      if (errorText) {
        updateSession(sessionId, { step: "error", error: errorText });
        return NextResponse.json(
          { error: `Upload failed: ${errorText}` },
          { status: 400 }
        );
      }
    }

    updateSession(sessionId, { step: "awaiting_evc" });
    return NextResponse.json({ step: "uploaded" });
  } catch (err) {
    console.error("[gst-portal/upload] error:", err);
    return NextResponse.json(
      { error: "Failed to upload GSTR-1. The portal UI may have changed." },
      { status: 500 }
    );
  } finally {
    // Clean up temp file
    if (tempFilePath && existsSync(tempFilePath)) {
      try { unlinkSync(tempFilePath); } catch { /* ignore */ }
    }
  }
}
