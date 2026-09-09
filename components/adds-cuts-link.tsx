"use client";

import Link from "next/link";
import { prefetchHomeData } from "@/lib/prefetch-home";

export function AddsCutsLink({
  href = "/adds-cuts",
  className,
  children,
}: {
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={className} onMouseEnter={() => prefetchHomeData()} onFocus={() => prefetchHomeData()}>
      {children}
    </Link>
  );
}
