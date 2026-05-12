import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "西语学习平台",
  description: "面向中文母语者的西班牙语学习平台"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
