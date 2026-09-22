import { DEFAULT_COMPANY_NAME } from "./company-branding-contract";

export function getPortalBrandingMetadata(companyName: string) {
  const normalizedCompanyName = companyName.trim() || DEFAULT_COMPANY_NAME;

  return {
    title: `${normalizedCompanyName} — Customer Portal`,
    appleWebAppTitle: `${normalizedCompanyName} Portal`,
  };
}
