import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Mutual fund screener · Thinkbrew",
  description:
    "Screen Indian Direct Growth mutual funds by Sharpe, TER, PE, CAGR, and AUM across equity, debt, hybrid, and index. Not investment advice.",
  path: "/screener",
});

export default function ScreenerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
