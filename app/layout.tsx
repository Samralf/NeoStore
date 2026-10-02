import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "نيو كافي ستور | إدارة المتجر",
  description: "إدارة المبيعات والمخزون والطلبات في نيو كافي ستور",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
