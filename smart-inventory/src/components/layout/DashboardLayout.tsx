import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { StaffDocumentTitle } from "@/components/branding/StaffDocumentTitle";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <StaffDocumentTitle />
        <Sidebar />
        <Header />
        <main className="ml-[230px] pt-16">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
