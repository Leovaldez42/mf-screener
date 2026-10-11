"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SectorPill } from "@/components/sector-pill";
import type { StockDirectoryRow } from "@/lib/directory";
import { formatMonthLabel } from "@/lib/format";

function letterOf(name: string) {
  const ch = (name.trim()[0] || "#").toUpperCase();
  return /[A-Z]/.test(ch) ? ch : "#";
}

export function StocksIndex({
  stocks,
  month,
  initialQ = "",
}: {
  stocks: StockDirectoryRow[];
  month: string | null;
  initialQ?: string;
}) {
  const [q, setQ] = useState(initialQ);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return stocks;
    return stocks.filter(
      (s) => s.name.toLowerCase().includes(needle) || s.sector.toLowerCase().includes(needle),
    );
  }, [stocks, q]);

  const groups = useMemo(() => {
    const map = new Map<string, StockDirectoryRow[]>();
    for (const s of filtered) {
      const letter = letterOf(s.name);
      const list = map.get(letter) || [];
      list.push(s);
      map.set(letter, list);
    }
    return [...map.entries()].sort((a, b) => {
      if (a[0] === "#") return 1;
      if (b[0] === "#") return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-medium">Stocks held by Indian mutual funds</h1>
        <p className="mt-1 text-sm text-muted">
          Equity names in at least one active-equity book
          {month ? ` as of ${formatMonthLabel(month)}` : ""}.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="h-9 w-44 rounded border border-border bg-input px-2.5 text-sm sm:w-56"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name or sector"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {q ? (
          <button
            type="button"
            className="h-9 shrink-0 px-1 text-sm text-muted underline hover:text-foreground"
            onClick={() => setQ("")}
          >
            Clear
          </button>
        ) : null}
      </div>
      <p className="text-xs text-faint">
        {filtered.length} stock{filtered.length === 1 ? "" : "s"}
      </p>
      {groups.map(([letter, rows]) => (
        <section key={letter} className="space-y-2">
          <h2 className="text-sm font-medium text-foreground">{letter}</h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {rows.map((s) => (
              <li key={s.id}>
                <Link
                  href={month ? `/stocks/${s.id}?month=${month}` : `/stocks/${s.id}`}
                  className="block px-4 py-3 hover:bg-surface"
                >
                  <div className="text-sm font-medium">{s.name}</div>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                    <SectorPill sector={s.sector} />
                    <span>
                      {s.fund_count} fund{s.fund_count === 1 ? "" : "s"}
                    </span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!filtered.length ? <p className="text-sm text-muted">No stocks match that filter.</p> : null}
    </div>
  );
}
