import { NextResponse } from "next/server";

import { getCompanyBrandingRecord } from "@/lib/company-branding";
import { toPublicCompanyBranding } from "@/lib/company-branding-contract";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const branding = toPublicCompanyBranding(await getCompanyBrandingRecord());
    return NextResponse.json(branding, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Error fetching public company branding:", error);
    return NextResponse.json(
      { error: "Failed to fetch company branding" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
