import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Compare mutual funds · Thinkbrew",
  description:
    "Compare Indian Direct Growth schemes side by side on expense ratio, Sharpe, CAGR, and AUM. Not investment advice.",
  path: "/compare",
});

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
