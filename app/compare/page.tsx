"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { COMPARE_MAX, type SchemeMetric } from "@/lib/scheme-metrics";
import { formatNumber } from "@/lib/format";
import { loadCompare, saveCompare } from "@/components/ui";

const ROWS: { key: keyof SchemeMetric; label: string; digits?: number }[] = [
  { key: "fund_house", label: "Fund house" },
  { key: "category", label: "Category" },
  { key: "expense_ratio", label: "Expense ratio %", digits: 2 },
  { key: "sharpe_1y", label: "Sharpe 1Y", digits: 2 },
  { key: "sharpe_3y", label: "Sharpe 3Y", digits: 2 },
  { key: "sharpe_5y", label: "Sharpe 5Y", digits: 2 },
  { key: "sortino_3y", label: "Sortino 3Y", digits: 2 },
  { key: "std_dev_3y", label: "Std dev 3Y", digits: 2 },
  { key: "cagr_1y", label: "CAGR 1Y %", digits: 2 },
  { key: "cagr_3y", label: "CAGR 3Y %", digits: 2 },
  { key: "cagr_5y", label: "CAGR 5Y %", digits: 2 },
  { key: "cagr_10y", label: "CAGR 10Y %", digits: 2 },
  { key: "cagr_inception", label: "CAGR inception %", digits: 2 },
  { key: "aum_cr", label: "AUM ₹ cr", digits: 0 },
];

function cell(s: SchemeMetric, key: keyof SchemeMetric, digits?: number) {
  const v = s[key];
  if (typeof v === "number") return formatNumber(v, digits ?? 2);
  if (typeof v === "string" && v) return v;
  return "—";
}

function CompareInner() {
  const search = useSearchParams();
  const [schemes, setSchemes] = useState<SchemeMetric[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SchemeMetric[]>([]);

  useEffect(() => {
    const fromUrl = (search.get("codes") || "").split(",").map((s) => s.trim()).filter(Boolean);
    setCodes(fromUrl.length ? fromUrl : loadCompare());
  }, [search]);

  useEffect(() => {
    if (codes.length < 2) {
      setSchemes([]);
      return;
    }
    fetch(`/api/v1/schemes/compare?codes=${codes.join(",")}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) setError(d.error || "Could not compare");
        else setError(null);
        setSchemes(d.schemes || []);
      })
      .catch(() => setError("Could not compare"));
  }, [codes]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/v1/schemes?q=${encodeURIComponent(q.trim())}&limit=12&sort=aum_cr`)
        .then((r) => r.json())
        .then((d) => setHits(d.schemes || []))
        .catch(() => setHits([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  function add(code: string) {
    setCodes((prev) => {
      if (prev.includes(code) || prev.length >= COMPARE_MAX) return prev;
      const next = [...prev, code];
      saveCompare(next);
      return next;
    });
    setQ("");
    setHits([]);
  }

  function remove(code: string) {
    setCodes((prev) => {
      const next = prev.filter((c) => c !== code);
      saveCompare(next);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-medium">Compare funds</h1>
        <p className="text-sm text-zinc-400">
          Search and add up to {COMPARE_MAX} Direct Growth schemes. You can also tick rows on the{" "}
          <Link className="underline" href="/screener">
            screener
          </Link>
          .
        </p>
      </div>

      <div className="relative max-w-xl">
        <input
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type a fund name or AMC…"
        />
        {hits.length > 0 ? (
          <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded border border-zinc-700 bg-zinc-900 text-sm">
            {hits.map((h) => (
              <li key={h.scheme_code}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-zinc-800"
                  onClick={() => add(h.scheme_code)}
                >
                  <div>{h.name}</div>
                  <div className="text-xs text-zinc-500">
                    {h.fund_house} · {h.category}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {codes.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {schemes.map((s) => (
            <button
              key={s.scheme_code}
              type="button"
              className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500"
              onClick={() => remove(s.scheme_code)}
            >
              {s.name} ×
            </button>
          ))}
          {codes
            .filter((c) => !schemes.some((s) => s.scheme_code === c))
            .map((c) => (
              <button
                key={c}
                type="button"
                className="rounded border border-zinc-800 px-2 py-1 text-xs text-zinc-500"
                onClick={() => remove(c)}
              >
                {c} ×
              </button>
            ))}
        </div>
      ) : null}

      {error ? <p className="text-sm text-amber-400">{error}</p> : null}
      {codes.length < 2 && !error ? (
        <p className="text-sm text-zinc-500">Add at least two funds above to see the table.</p>
      ) : null}
      {schemes.length >= 2 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-2 pr-3 font-normal w-40">Metric</th>
                {schemes.map((s) => (
                  <th key={s.scheme_code} className="py-2 pr-3 font-normal align-bottom">
                    <Link className="text-zinc-100 hover:underline" href={`/schemes/${s.scheme_code}`}>
                      {s.name}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.key} className="border-t border-zinc-800">
                  <td className="py-2 pr-3 text-zinc-400">{row.label}</td>
                  {schemes.map((s) => (
                    <td key={s.scheme_code} className="py-2 pr-3">
                      {cell(s, row.key, row.digits)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <CompareInner />
    </Suspense>
  );
}
