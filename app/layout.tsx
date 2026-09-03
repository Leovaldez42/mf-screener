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
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png" }],
  },
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
        {process.env.NODE_ENV === "production" ? (
          <Script
            src="https://cloud.umami.is/script.js"
            data-website-id="b8ea7ec0-8b63-41f3-bc3f-6d375ce82a0c"
            strategy="afterInteractive"
          />
        ) : null}
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
          <Shell>{children}</Shell>
        </Suspense>
      </body>
    </html>
  );
}
