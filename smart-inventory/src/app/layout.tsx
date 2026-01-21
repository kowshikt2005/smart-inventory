import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SWRProvider } from "@/lib/swr-provider";
import { SessionProvider } from "@/components/providers/SessionProvider";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
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
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <SessionProvider>
          <SWRProvider>{children}</SWRProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
