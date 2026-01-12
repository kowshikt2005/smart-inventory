import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { AuthGuard } from "@/components/auth/AuthGuard";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <Header />
        <main className="ml-64 pt-16">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
