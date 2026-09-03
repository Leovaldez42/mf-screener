import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import { Shell } from "@/components/ui";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "MF Chase",
  description: "Holdings chase plus fund screener and compare for Indian active-equity MFs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`}>
        <Script id="mf-chase-theme" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem("mf-chase-theme");var dark=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(dark)document.documentElement.classList.add("dark");else document.documentElement.classList.remove("dark");}catch(e){}})();`}
        </Script>
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
          <Shell>{children}</Shell>
        </Suspense>
      </body>
    </html>
  );
}
