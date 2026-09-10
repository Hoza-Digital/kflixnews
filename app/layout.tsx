import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KFLIXMEDIA — Culture in motion",
  description: "Entertainment news for what comes next.",
};

import { ThemeProvider } from "./components/theme-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
