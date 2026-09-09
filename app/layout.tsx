import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import { Shell } from "@/components/ui";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.thinkbrew.in"),
  title: "MF Chase",
  description:
    "See what Indian active-equity mutual funds bought and sold last month. Adds and cuts, fund screener, and compare. Not investment advice.",
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
      <body className={`${geistSans.variable} font-sans antialiased bg-background text-foreground`}>
        <Script id="mf-chase-theme" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem("mf-chase-theme");var dark=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(dark)document.documentElement.classList.add("dark");else document.documentElement.classList.remove("dark");}catch(e){}})();`}
        </Script>
        {process.env.NODE_ENV === "production" ? (
          <Script
            src="https://cloud.umami.is/script.js"
            data-website-id="b8ea7ec0-8b63-41f3-bc3f-6d375ce82a0c"
            strategy="lazyOnload"
          />
        ) : null}
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
