"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { OverlapView } from "@/app/overlap/overlap-view";
import type { FundDirectoryRow } from "@/lib/directory";
import { FUNDS_TABS, fundsHubPath, parseFundsTab, pickTabParams, type FundsTab } from "@/lib/funds-hub";
import { CompareTab } from "./compare-tab";
import { FundsIndex } from "./funds-index";
import { ScreenerTab } from "./screener-tab";

const TAB_LABEL: Record<FundsTab, string> = {
  screener: "Screener",
  compare: "Compare",
  overlap: "Overlap",
  all: "All funds A–Z",
};

type OverlapInit = {
  data: Parameters<typeof OverlapView>[0]["initialData"];
  error: string | null;
  suggestions: Parameters<typeof OverlapView>[0]["initialSuggestions"];
};

export function FundsHub({
  tab,
  fundCount,
  houseCount,
  funds,
  overlap,
}: {
  tab: FundsTab;
  fundCount: number;
  houseCount: number;
  funds: FundDirectoryRow[];
  overlap: OverlapInit;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [stored, setStored] = useState<Record<FundsTab, string>>(() => ({
    screener: pickTabParams("screener", search).toString(),
    compare: pickTabParams("compare", search).toString(),
    overlap: pickTabParams("overlap", search).toString(),
    all: pickTabParams("all", search).toString(),
  }));

  useEffect(() => {
    const qs = pickTabParams(tab, search).toString();
    setStored((prev) => (prev[tab] === qs ? prev : { ...prev, [tab]: qs }));
  }, [search, tab]);

  const tabHrefs = useMemo(() => {
    const out = {} as Record<FundsTab, string>;
    for (const id of FUNDS_TABS) {
      out[id] = fundsHubPath(id, new URLSearchParams(stored[id]));
    }
    return out;
  }, [stored]);

  const screenerSearch = tab === "screener" ? pickTabParams("screener", search).toString() : stored.screener;
  const allQ = (tab === "all" ? search.get("q") : new URLSearchParams(stored.all).get("q")) || "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Funds</h1>
        <p className="mt-1 text-sm text-muted">
          Screen, compare and check overlap across {fundCount} equity mutual funds from {houseCount} fund houses.
        </p>
      </div>

      <div className="-mx-4 overflow-x-auto border-b border-border px-4 scrollbar-none sm:mx-0 sm:px-0">
        <nav className="flex min-w-max items-end gap-5" aria-label="Funds tools">
          {FUNDS_TABS.map((id) => {
            const on = tab === id;
            return (
              <Link
                key={id}
                href={tabHrefs[id]}
                scroll={false}
                className={`inline-flex items-center gap-1.5 border-b-2 pb-2.5 text-sm ${
                  on
                    ? "border-accent font-medium text-foreground"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
                aria-current={on ? "page" : undefined}
              >
                {TAB_LABEL[id]}
                {id === "all" && fundCount ? <span className="text-xs text-faint">{fundCount}</span> : null}
              </Link>
            );
          })}
        </nav>
      </div>

      {tab === "screener" ? <ScreenerTab key={`${pathname}?${screenerSearch}`} initialSearch={screenerSearch} /> : null}
      {tab === "compare" ? <CompareTab /> : null}
      {tab === "overlap" ? (
        <OverlapView
          key={search.get("funds") || "none"}
          initialData={overlap.data}
          initialError={overlap.error}
          initialSuggestions={overlap.suggestions}
        />
      ) : null}
      {tab === "all" ? <FundsIndex funds={funds} initialQ={allQ} embedded /> : null}
    </div>
  );
}
