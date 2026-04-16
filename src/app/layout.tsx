import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "キャンプ場予約システム | Campsite Booking",
  description: "完全自動化されたキャンプ場予約〜チェックインシステム。LINE連携・QRチェックインで快適なキャンプ体験を提供します。",
  keywords: "キャンプ場,予約,チェックイン,QRコード,自動化",
  authors: [{ name: "Campsite Booking Team" }],
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
