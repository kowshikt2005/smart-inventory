import { getCompanyBrandingRecord } from "@/lib/company-branding";
import { getCompanyLogoFilename } from "@/lib/company-branding-contract";
import { createCompanyLogoResponse } from "@/lib/company-logo-response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const branding = await getCompanyBrandingRecord();
    return createCompanyLogoResponse(
      getCompanyLogoFilename(branding.storedLogoUrl),
    );
  } catch (error) {
    console.error("Error serving public company logo:", error);
    return new Response("Company logo not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
