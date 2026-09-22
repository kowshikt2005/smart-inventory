"use client";

import { useEffect } from "react";

import { useCompanyBranding } from "@/hooks/use-company-branding";

export function StaffDocumentTitle() {
  const { branding } = useCompanyBranding();

  useEffect(() => {
    document.title = `${branding.companyName} ERP`;
  }, [branding.companyName]);

  return null;
}
