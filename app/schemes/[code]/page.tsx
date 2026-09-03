"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { type CategoryAverage, type SchemeMetric } from "@/lib/scheme-metrics";
import { formatDelta, formatNumber } from "@/lib/format";

export default function SchemePage() {
  const { code } = useParams<{ code: string }>();
  const [scheme, setScheme] = useState<SchemeMetric | null>(null);
  const [categoryAverage, setCategoryAverage] = useState<CategoryAverage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/schemes/${code}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) setError(d.error || "Not found");
        else {
          setScheme(d.scheme);
          setCategoryAverage(d.categoryAverage || null);
        }
      })
      .catch(() => setError("Not found"));
  }, [code]);

  if (error) return <p className="text-sm text-amber-400">{error}</p>;
  if (!scheme) return <p className="text-sm text-faint">Loading…</p>;

  const stats: { label: string; key: keyof SchemeMetric; invert?: boolean; digits: number }[] = [
    { label: "Expense ratio %", key: "expense_ratio", invert: true, digits: 2 },
    { label: "PE", key: "pe", invert: true, digits: 2 },
    { label: "Sharpe 1Y", key: "sharpe_1y", digits: 2 },
    { label: "Sharpe 3Y", key: "sharpe_3y", digits: 2 },
    { label: "Sharpe 5Y", key: "sharpe_5y", digits: 2 },
    { label: "Sortino 3Y", key: "sortino_3y", digits: 2 },
    { label: "Std dev 3Y", key: "std_dev_3y", invert: true, digits: 2 },
    { label: "CAGR 1Y %", key: "cagr_1y", digits: 2 },
    { label: "CAGR 3Y %", key: "cagr_3y", digits: 2 },
    { label: "CAGR 5Y %", key: "cagr_5y", digits: 2 },
    { label: "CAGR 10Y %", key: "cagr_10y", digits: 2 },
    { label: "CAGR inception %", key: "cagr_inception", digits: 2 },
    { label: "AUM ₹ cr", key: "aum_cr", digits: 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-medium">{scheme.name}</h1>
        <p className="text-sm text-muted">
          {scheme.fund_house} · {scheme.category} · Direct Growth · {scheme.scheme_code}
        </p>
        {categoryAverage ? (
          <p className="mt-1 text-xs text-faint">
            Category average is equal-weight across {categoryAverage.n} Direct Growth peers in this SEBI
            category.
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const value = scheme[stat.key];
          const num = typeof value === "number" ? value : null;
          const avg =
            categoryAverage && stat.key in categoryAverage
              ? (categoryAverage[stat.key as keyof CategoryAverage] as number | null)
              : null;
          const delta = num != null && avg != null ? num - avg : null;
          const better = delta != null && (stat.invert ? delta < 0 : delta > 0);
          const worse = delta != null && (stat.invert ? delta > 0 : delta < 0);
          return (
            <div key={stat.label} className="rounded border border-border px-3 py-2">
              <div className="text-xs text-faint">{stat.label}</div>
              <div className="text-lg">{formatNumber(num, stat.digits)}</div>
              <div className="mt-1 text-xs text-faint">
                Cat avg {formatNumber(avg, stat.digits)}
                {delta != null ? (
                  <span className={better ? " text-gain" : worse ? " text-loss" : ""}>
                    {" "}
                    ({formatDelta(delta, stat.digits)})
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-sm text-faint">
        <Link className="underline" href={`/funds/${scheme.scheme_code}`}>
          Holdings / Chase book
        </Link>
        {" — "}
        available for every Direct Growth active-equity scheme after holdings ingest.
        {" · "}
        <Link className="underline" href="/screener">
          Back to screener
        </Link>
      </p>
    </div>
  );
}
