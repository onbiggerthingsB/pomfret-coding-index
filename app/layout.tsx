import type { Metadata } from "next";
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

const geistSerif = localFont({
  src: "./fonts/geist-serif/GeistSerif-Regular.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-geist-serif",
});

export const metadata: Metadata = {
  title: "The Coding Index",
  description: "Find components, design references, developer tools and learning resources for your next project. Built for Advanced Coding.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${geistSerif.variable}`}>
      {/* Browser extensions write their own attributes onto <body> before React loads (ColorZilla adds cz-shortcut-listen).
          That is not a bug in the page, so the mismatch warning is switched off for this one element only. */}
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
