import type { Metadata, Viewport } from "next";
import { CartProvider } from "@/components/portal/CartContext";
import { PortalTopbar } from "@/components/portal/PortalTopbar";
import { PortalSidebar } from "@/components/portal/PortalSidebar";
import { PortalMobileHeader } from "@/components/portal/PortalMobileHeader";
import { PortalBottomNav } from "@/components/portal/PortalBottomNav";

// Viewport export — themeColor moved here in Next.js 14+ (not in metadata)
export const viewport: Viewport = {
  themeColor: "#2D2A5E",
};

export const metadata: Metadata = {
  title: "Sri Balaji Enterprise — Customer Portal",
  manifest: "/portal-manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "SBE Portal",
  },
  icons: {
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

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
          <main className="flex-1 pb-20 md:pb-0">{children}</main>
        </div>

        {/* Mobile: fixed bottom nav — hidden on desktop */}
        <PortalBottomNav />
      </div>
    </CartProvider>
  );
}
