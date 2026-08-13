import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "STORY — Publishing Dashboard",
  description: "A clean dashboard for managing articles and audience growth.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
