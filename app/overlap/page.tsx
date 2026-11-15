import { Suspense } from "react";
import { OverlapView } from "./overlap-view";
import { pageMetadata } from "@/lib/page-meta";

export const revalidate = 86400;

export const metadata = pageMetadata({
  title: "Fund overlap checker · Thinkbrew",
  description:
    "See how much the equity books of Indian active funds overlap. Shared stocks, unique names, and sector overlap. Not investment advice.",
  path: "/funds?tab=overlap",
});

export default function OverlapPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading overlap…</p>}>
      <OverlapView initialData={null} initialError={null} initialSuggestions={[]} />
    </Suspense>
  );
}
