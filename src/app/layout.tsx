import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
import { ToastProvider } from "@/components/ui/Toast";
import { PWAInstallBanner } from "@/components/ui/PWAInstallBanner";

export const metadata: Metadata = {
  title: "AHL HR Command Center",
  description: "Workforce Overview, Milestone Tracker & HR Command Center for American Hairline",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AHL HR",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B1F2A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="antialiased">
        <ToastProvider>
          <PWAInstallBanner />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
