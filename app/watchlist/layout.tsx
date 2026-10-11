import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Watchlist · Thinkbrew",
  description: "Your browser-only stock watchlist on Thinkbrew. Not investment advice.",
  path: "/watchlist",
  noindex: true,
});

export default function WatchlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
