"use client";

import { Suspense } from "react";
import { CompareTab } from "@/app/funds/compare-tab";

export default function ComparePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading compare…</p>}>
      <CompareTab />
    </Suspense>
  );
}
