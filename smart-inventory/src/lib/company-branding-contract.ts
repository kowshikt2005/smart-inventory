export interface BrandingSetting {
  key: string;
  value: string;
}

export interface CompanyBrandingRecord {
  companyName: string;
  storedLogoUrl: string | null;
}

export interface CompanyBranding {
  companyName: string;
  logoUrl: string | null;
}

export const DEFAULT_COMPANY_NAME = "Company Name";
export const PUBLIC_COMPANY_LOGO_URL = "/api/branding/logo";

const COMPANY_LOGO_PATTERN =
  /^\/api\/uploads\/company\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpe?g|png|webp))$/i;

export function getCompanyLogoFilename(storedUrl: string | null): string | null {
  if (!storedUrl) return null;
  return COMPANY_LOGO_PATTERN.exec(storedUrl)?.[1] ?? null;
}

export function isCompanyLogoUploadPath(value: string): boolean {
  return value === "" || getCompanyLogoFilename(value) !== null;
}

export function normalizeCompanyBranding(
  settings: BrandingSetting[],
): CompanyBrandingRecord {
  const values = new Map(settings.map((setting) => [setting.key, setting.value]));
  const configuredName = values.get("company_name")?.trim();
  const candidateLogoUrl = values.get("company_logo_url")?.trim() || null;

  return {
    companyName: configuredName || DEFAULT_COMPANY_NAME,
    storedLogoUrl: getCompanyLogoFilename(candidateLogoUrl)
      ? candidateLogoUrl
      : null,
  };
}

export function toPublicCompanyBranding(
  record: CompanyBrandingRecord,
): CompanyBranding {
  return {
    companyName: record.companyName,
    logoUrl: record.storedLogoUrl ? PUBLIC_COMPANY_LOGO_URL : null,
  };
}
