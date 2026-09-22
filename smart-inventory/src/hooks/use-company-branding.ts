"use client";

import useSWR from "swr";

import {
  DEFAULT_COMPANY_NAME,
  type CompanyBranding,
} from "@/lib/company-branding-contract";

const FALLBACK_BRANDING: CompanyBranding = {
  companyName: DEFAULT_COMPANY_NAME,
  logoUrl: null,
};

export function useCompanyBranding() {
  const { data, error, isLoading } = useSWR<CompanyBranding>("/api/branding");

  return {
    branding: data ?? FALLBACK_BRANDING,
    error,
    isLoading,
  };
}
