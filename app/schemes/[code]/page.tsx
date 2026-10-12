import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSchemePage } from "@/lib/cached-metrics";
import { classShowsPe, parseAssetClass } from "@/lib/fund-class";
import { formatDelta, formatNumber } from "@/lib/format";
import { pageMetadata } from "@/lib/page-meta";
import { type CategoryAverage, type SchemeMetric } from "@/lib/scheme-metrics";
import { supabaseConfigured } from "@/lib/supabase";

export const revalidate = 120;

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  if (!supabaseConfigured()) return { title: "Scheme" };
  const payload = await getSchemePage(code);
  if ("error" in payload && payload.error === "not_found") return { title: "Scheme not found" };
  const scheme = payload.scheme;
  const aum = scheme.aum_cr != null ? `AUM ₹${formatNumber(scheme.aum_cr, 0)} cr` : null;
  return pageMetadata({
    title: `${scheme.name} · Thinkbrew`,
    description: `${scheme.fund_house} · ${scheme.category}${aum ? ` · ${aum}` : ""}. Direct Growth scheme metrics. Not investment advice.`,
    path: `/schemes/${code}`,
  });
}

export default async function SchemePage({ params }: Props) {
  const { code } = await params;
  if (!supabaseConfigured()) {
    return <p className="text-sm text-muted">Scheme data is not configured.</p>;
  }
  const payload = await getSchemePage(code);
  if ("error" in payload && payload.error === "not_found") notFound();
  const scheme = payload.scheme;
  const categoryAverage = payload.categoryAverage;

  const assetClass = parseAssetClass(scheme.asset_class);
  const stats: { label: string; key: keyof SchemeMetric; invert?: boolean; digits: number }[] = [
    { label: "Expense ratio %", key: "expense_ratio", invert: true, digits: 2 },
    ...(classShowsPe(assetClass) ? [{ label: "PE", key: "pe" as const, invert: true, digits: 2 }] : []),
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
          const hiddenInception = stat.key === "cagr_inception" && scheme.inception_cagr_reliable === false;
          const num = hiddenInception ? null : typeof value === "number" ? value : null;
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
              <div className="text-lg" title={hiddenInception ? "Vendor value looks wrong, hidden" : undefined}>
                {formatNumber(num, stat.digits)}
              </div>
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
        {assetClass === "equity-active" ? (
          <>
            <Link className="underline" href={`/funds/${scheme.scheme_code}`}>
              Holdings book
            </Link>
            {" — monthly adds and cuts for active-equity schemes. "}
          </>
        ) : (
          <>Adds & cuts books are only for active-equity schemes. </>
        )}
        <Link className="underline" href="/funds">
          Back to screener
        </Link>
      </p>
    </div>
  );
}
