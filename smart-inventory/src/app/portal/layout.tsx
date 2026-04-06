import { CartProvider } from "@/components/portal/CartContext";
import { PortalTopbar } from "@/components/portal/PortalTopbar";
import { PortalSidebar } from "@/components/portal/PortalSidebar";

export const metadata = { title: "Sri Balaji Enterprise — Customer Portal" };

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-gray-50">
        <PortalSidebar />
        <div className="ml-[230px] flex flex-col min-h-screen">
          <PortalTopbar />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </CartProvider>
  );
}
