"use client";

import { useEffect } from "react";
import { prefetchHomeData, seedChasePreview } from "@/lib/prefetch-home";
import type { ChaseRow } from "@/lib/types";

export function PrefetchHome({
  month,
  seed,
}: {
  month?: string;
  seed?: ChaseRow[];
}) {
  useEffect(() => {
    if (month && seed?.length) seedChasePreview(month, seed);
    prefetchHomeData(month);
  }, [month, seed]);
  return null;
}
