import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Adds & cuts · Thinkbrew",
  description:
    "What Indian active-equity mutual funds bought and sold last month, by share quantity. Not investment advice.",
  path: "/adds-cuts",
});

export default function AddsCutsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
