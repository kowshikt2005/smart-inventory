import { db } from "@/lib/db";
import {
  normalizeCompanyBranding,
  type CompanyBrandingRecord,
} from "@/lib/company-branding-contract";

const BRANDING_SETTING_KEYS = ["company_name", "company_logo_url"];

export async function getCompanyBrandingRecord(): Promise<CompanyBrandingRecord> {
  const settings = await db.appSetting.findMany({
    where: { key: { in: BRANDING_SETTING_KEYS } },
    select: { key: true, value: true },
  });

  return normalizeCompanyBranding(settings);
}
