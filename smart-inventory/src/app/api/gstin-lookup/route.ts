import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { validateGstin, normalizeGstin } from "@/lib/gst-validation";

export async function POST(req: NextRequest) {
  const { error } = await checkAuth();
  if (error) return error;

  try {
    const body = await req.json();
    const { gstin, captcha, captchaCookie } = body as {
      gstin: string;
      captcha: string;
      captchaCookie: string;
    };

    if (!gstin || !captcha || !captchaCookie) {
      return NextResponse.json(
        { error: "gstin, captcha, and captchaCookie are required" },
        { status: 400 }
      );
    }

    // Validate captcha format (6 digits)
    if (!/^\d{6}$/.test(captcha.trim())) {
      return NextResponse.json({ error: "Captcha must be 6 digits" }, { status: 400 });
    }

    // Validate GSTIN format locally before hitting the portal
    const normalized = normalizeGstin(gstin);
    const validation = validateGstin(normalized);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Call GST portal — forward the CaptchaCookie as a session identifier
    const gstResponse = await fetch(
      "https://services.gst.gov.in/services/api/search/taxpayerDetails",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": `CaptchaCookie=${captchaCookie}`,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://services.gst.gov.in/services/searchtp",
          "Origin": "https://services.gst.gov.in",
        },
        body: JSON.stringify({ gstin: normalized, captcha: captcha.trim() }),
        cache: "no-store",
      }
    );

    const data = await gstResponse.json();

    // Handle GST portal error codes
    if (data.errorCode === "SWEB_9000") {
      return NextResponse.json(
        { error: "Wrong captcha. Please try again.", code: "INVALID_CAPTCHA" },
        { status: 400 }
      );
    }
    if (data.errorCode === "SWEB_9035" || data.errorCode === "SWEB_9032") {
      return NextResponse.json(
        { error: "GSTIN not found on the GST portal.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }
    if (data.errorCode === "SWEB_9034") {
      return NextResponse.json({ error: "GSTIN is required." }, { status: 400 });
    }
    if (data.errorCode) {
      return NextResponse.json(
        { error: `GST portal returned an error (${data.errorCode})` },
        { status: 502 }
      );
    }

    // Parse the flat address string — GST portal returns only pradr.adr (no structured addr)
    // Format: "Part1, Part2, ..., City, State, Pincode"
    const adr = (data.pradr?.adr ?? "") as string;
    const parts = adr.split(",").map((p: string) => p.trim()).filter(Boolean);

    const lastPart = parts[parts.length - 1] ?? "";
    const pincode = /^\d{6}$/.test(lastPart) ? lastPart : "";
    const withoutPincode = pincode ? parts.slice(0, -1) : parts;
    const city = withoutPincode.length >= 2 ? withoutPincode[withoutPincode.length - 2] : "";
    // Everything before city + state goes into addressLine1 as-is
    const addressLine1 = withoutPincode.slice(0, -2).join(", ");
    const addressLine2 = "";

    return NextResponse.json({
      legalName: data.lgnm ?? "",
      tradeName: data.tradeNam ?? "",
      status: data.sts ?? "Unknown",
      address: adr,
      addressLine1,
      addressLine2,
      city,
      pincode,
      businessType: data.ctb ?? "",
      stateCode: normalized.substring(0, 2),
    });
  } catch (err) {
    console.error("[gstin-lookup] error:", err);
    return NextResponse.json({ error: "Failed to verify GSTIN" }, { status: 500 });
  }
}
