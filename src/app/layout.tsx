import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/styles/ticket-thermal.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SmartTicketQR - Digital Ticket Management & Validation",
  description:
    "Professional QR-code-based ticket management system for events, transportation (bus, boat, ferry), concerts, and more. Generate, sell, distribute, and validate tickets in real-time.",
  keywords: [
    "SmartTicketQR",
    "QR code tickets",
    "event management",
    "ticket validation",
    "transport tickets",
    "bus tickets",
    "boat tickets",
    "digital tickets",
  ],
  authors: [{ name: "SmartTicketQR Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "SmartTicketQR - Digital Ticket Management",
    description: "QR-code-based ticket management and validation platform",
    siteName: "SmartTicketQR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
