// Timestamp: 2026-06-03 01:11
import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import { Suspense } from "react";
import { BottomTabBar } from "@/app/components/web/BottomTabBar";
import { ServiceWorkerRegister } from "@/app/components/web/ServiceWorkerRegister";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Esponal",
  description: "面向中文母语者的西班牙语学习平台",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Esponal"
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#10b981"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${outfit.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('color-theme');
                  var isDark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  document.documentElement.classList.toggle('dark', isDark);
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <ServiceWorkerRegister />
        {children}
        <Suspense fallback={null}>
          <BottomTabBar />
        </Suspense>
      </body>
    </html>
  );
}
