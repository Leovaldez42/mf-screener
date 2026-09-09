"use client";

import { useEffect } from "react";
import { prefetchHomeData } from "@/lib/prefetch-home";

export function PrefetchHome({ month }: { month?: string }) {
  useEffect(() => {
    prefetchHomeData(month);
  }, [month]);
  return null;
}
