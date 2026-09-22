import type { Metadata, Viewport } from "next";
import { CartProvider } from "@/components/portal/CartContext";
import { PortalTopbar } from "@/components/portal/PortalTopbar";
import { PortalSidebar } from "@/components/portal/PortalSidebar";
import { PortalMobileHeader } from "@/components/portal/PortalMobileHeader";
import { PortalBottomNav } from "@/components/portal/PortalBottomNav";
import { InactivityGuard } from "@/components/portal/InactivityGuard";
import { getCompanyBrandingRecord } from "@/lib/company-branding";
import { DEFAULT_COMPANY_NAME } from "@/lib/company-branding-contract";
import { getPortalBrandingMetadata } from "@/lib/portal-branding";

// Viewport export — themeColor moved here in Next.js 14+ (not in metadata)
export const viewport: Viewport = {
  themeColor: "#2D2A5E",
};

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  let portalMetadata = getPortalBrandingMetadata(DEFAULT_COMPANY_NAME);

  try {
    const branding = await getCompanyBrandingRecord();
    portalMetadata = getPortalBrandingMetadata(branding.companyName);
  } catch {
    // A temporary database failure should not prevent the portal shell from loading.
  }

  return {
    title: portalMetadata.title,
    manifest: "/portal-manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black",
      title: portalMetadata.appleWebAppTitle,
    },
    icons: {
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
  };
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Desktop: fixed sidebar — hidden on mobile */}
        <PortalSidebar />

        {/* Mobile: sticky purple header — hidden on desktop */}
        <PortalMobileHeader />

        {/* Content column — no left offset on mobile, 230px on desktop */}
        <div className="md:ml-[230px] flex flex-col min-h-screen">
          {/* Desktop: white topbar — hidden on mobile */}
          <PortalTopbar />
          {/* pb-20 on mobile leaves room above the fixed bottom nav */}
          <main className="flex-1 pb-20 md:pb-0">
            <InactivityGuard>{children}</InactivityGuard>
          </main>
        </div>

        {/* Mobile: fixed bottom nav — hidden on desktop */}
        <PortalBottomNav />
      </div>
    </CartProvider>
  );
}
