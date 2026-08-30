"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { type SchemeMetric } from "@/lib/scheme-metrics";
import { formatNumber } from "@/lib/format";

export default function SchemePage() {
  const { code } = useParams<{ code: string }>();
  const [scheme, setScheme] = useState<SchemeMetric | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/schemes/${code}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) setError(d.error || "Not found");
        else setScheme(d.scheme);
      })
      .catch(() => setError("Not found"));
  }, [code]);

  if (error) return <p className="text-sm text-amber-400">{error}</p>;
  if (!scheme) return <p className="text-sm text-zinc-500">Loading…</p>;

  const stats: [string, number | null][] = [
    ["Expense ratio %", scheme.expense_ratio],
    ["Sharpe 1Y", scheme.sharpe_1y],
    ["Sharpe 3Y", scheme.sharpe_3y],
    ["Sharpe 5Y", scheme.sharpe_5y],
    ["Sortino 3Y", scheme.sortino_3y],
    ["Std dev 3Y", scheme.std_dev_3y],
    ["CAGR 1Y %", scheme.cagr_1y],
    ["CAGR 3Y %", scheme.cagr_3y],
    ["CAGR 5Y %", scheme.cagr_5y],
    ["CAGR 10Y %", scheme.cagr_10y],
    ["CAGR inception %", scheme.cagr_inception],
    ["AUM ₹ cr", scheme.aum_cr],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-medium">{scheme.name}</h1>
        <p className="text-sm text-zinc-400">
          {scheme.fund_house} · {scheme.category} · Direct Growth · {scheme.scheme_code}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded border border-zinc-800 px-3 py-2">
            <div className="text-xs text-zinc-500">{label}</div>
            <div className="text-lg">{formatNumber(value, label.includes("AUM") ? 0 : 2)}</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-zinc-500">
        <Link className="underline" href={`/funds/${scheme.scheme_code}`}>
          Holdings / Chase book
        </Link>
        {" · "}
        <Link className="underline" href="/screener">
          Back to screener
        </Link>
      </p>
    </div>
  );
}
