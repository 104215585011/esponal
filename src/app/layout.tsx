// Timestamp: 2026-06-04 13:02
import type { Metadata, Viewport } from "next";
import { Noto_Sans_SC, Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import { BottomTabBar } from "@/app/components/web/BottomTabBar";
import { ServiceWorkerRegister } from "@/app/components/web/ServiceWorkerRegister";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const notoSansSc = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-noto-sc",
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
    <html lang="zh-CN" className={`${plusJakartaSans.variable} ${notoSansSc.variable}`}>
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
