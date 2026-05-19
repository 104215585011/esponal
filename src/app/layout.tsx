import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/app/components/web/ServiceWorkerRegister";
import "./globals.css";

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
    <html lang="zh-CN">
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
