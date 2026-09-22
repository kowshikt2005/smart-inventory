import type { Metadata } from "next";

import { getCompanyBrandingRecord } from "@/lib/company-branding";
import { DEFAULT_COMPANY_NAME } from "@/lib/company-branding-contract";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { companyName } = await getCompanyBrandingRecord();
    return {
      title: `${companyName} ERP`,
      description: `Sign in to the ${companyName} staff ERP`,
    };
  } catch {
    return {
      title: `${DEFAULT_COMPANY_NAME} ERP`,
      description: "Sign in to the staff ERP",
    };
  }
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
