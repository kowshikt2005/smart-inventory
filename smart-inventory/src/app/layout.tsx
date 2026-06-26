import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SWRProvider } from "@/lib/swr-provider";
import { SessionProvider } from "@/components/providers/SessionProvider";
import DevBadge from "@/components/DevBadge";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sri Balaji Enterprises ERP",
  description: "Enterprise Resource Planning system for Sri Balaji Enterprises",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <SessionProvider>
          <SWRProvider>
            {children}
            <Toaster richColors closeButton position="top-right" />
          </SWRProvider>
        </SessionProvider>
        <DevBadge />
      </body>
    </html>
  );
}
