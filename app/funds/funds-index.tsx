"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import type { FundDirectoryRow } from "@/lib/directory";
import { fundsHubPath } from "@/lib/funds-hub";

export function FundsIndex({
  funds,
  initialQ = "",
  embedded = false,
}: {
  funds: FundDirectoryRow[];
  initialQ?: string;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [category, setCategory] = useState("");
  const skipUrl = useRef(true);
  const categories = useMemo(() => {
    return [...new Set(funds.map((f) => f.category).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "en-IN"),
    );
  }, [funds]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return funds.filter((f) => {
      if (category && f.category !== category) return false;
      if (!needle) return true;
      return (
        f.name.toLowerCase().includes(needle) ||
        f.house.toLowerCase().includes(needle) ||
        f.category.toLowerCase().includes(needle)
      );
    });
  }, [funds, q, category]);

  const groups = useMemo(() => {
    const map = new Map<string, FundDirectoryRow[]>();
    for (const f of filtered) {
      const list = map.get(f.house) || [];
      list.push(f);
      map.set(f.house, list);
    }
    return [...map.entries()];
  }, [filtered]);

  useEffect(() => {
    if (!embedded) return;
    if (skipUrl.current) {
      skipUrl.current = false;
      return;
    }
    router.replace(fundsHubPath("all", q.trim() ? { q: q.trim() } : undefined), { scroll: false });
  }, [embedded, q, router]);

  return (
    <div className="space-y-6">
      {embedded ? null : (
        <div>
          <h1 className="text-xl font-medium">All mutual funds</h1>
          <p className="mt-1 text-sm text-muted">
            Active-equity Direct Growth families with a holdings book, grouped by fund house.
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="h-9 w-44 rounded border border-border bg-input px-2.5 text-sm sm:w-56"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name or house"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {q || category ? (
          <button
            type="button"
            className="h-9 shrink-0 px-1 text-sm text-muted underline hover:text-foreground"
            onClick={() => {
              setQ("");
              setCategory("");
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={`rounded-full border px-2.5 py-1 text-xs ${
            !category ? "border-foreground/30 bg-surface text-foreground" : "border-border text-muted hover:text-foreground"
          }`}
          onClick={() => setCategory("")}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className={`rounded-full border px-2.5 py-1 text-xs ${
              category === c
                ? "border-foreground/30 bg-surface text-foreground"
                : "border-border text-muted hover:text-foreground"
            }`}
            onClick={() => setCategory(c === category ? "" : c)}
          >
            {c}
          </button>
        ))}
      </div>
      <p className="text-xs text-faint">
        {filtered.length} fund{filtered.length === 1 ? "" : "s"}
        {category ? ` in ${category}` : ""}
      </p>
      {groups.map(([house, rows]) => (
        <section key={house} className="space-y-2">
          <h2 className="text-sm font-medium text-foreground">{house}</h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {rows.map((f) => (
              <li key={f.id}>
                <Link href={`/funds/${f.id}`} className="block px-4 py-3 hover:bg-surface">
                  <div className="text-sm font-medium">{f.name}</div>
                  <p className="mt-0.5 text-sm text-muted">
                    {f.category}
                    {f.aum_cr != null ? ` · AUM ₹${formatNumber(f.aum_cr, 0)} cr` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!filtered.length ? <p className="text-sm text-muted">No funds match that filter.</p> : null}
    </div>
  );
}
