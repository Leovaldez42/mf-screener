import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Sector flows · Thinkbrew",
  description:
    "Net buying and selling by sector across Indian active-equity mutual fund books. Not investment advice.",
  path: "/sectors",
});

export default function SectorsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
