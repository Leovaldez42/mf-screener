import type { Metadata } from "next";
import Link from "next/link";
import { ShareBar } from "@/components/share-bar";
import { cleanChaseRows } from "@/lib/chase-clean";
import { getChaseRows } from "@/lib/cached-holdings";
import { formatMonthLabel, formatNumber, sectorLabel } from "@/lib/format";
import { listCompleteMonths } from "@/lib/holdings-month";
import { monthShareCaption } from "@/lib/share-text";
import { isYearMonth, ogMonthPath, SITE_URL, siteUrl } from "@/lib/site";

type Props = { params: Promise<{ month: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { month: raw } = await params;
  if (!isYearMonth(raw)) return { title: "Month not found" };
  const complete = await listCompleteMonths();
  if (!complete.includes(raw)) return { title: "Month not found" };
  const month = raw;
  const label = formatMonthLabel(month);
  const title = `Adds & cuts · ${label}`;
  const description = `What Indian active-equity funds bought and sold in ${label}, by share count. Not investment advice.`;
  const url = siteUrl(`/month/${month}`);
  const image = siteUrl(ogMonthPath(month));
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: "MF Chase",
      images: [{ url: image, width: 1200, height: 630, type: "image/png" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function MonthPage({ params }: Props) {
  const { month: raw } = await params;
  if (!isYearMonth(raw)) {
    return <p className="text-sm text-muted">Unknown month.</p>;
  }
  const complete = await listCompleteMonths();
  if (!complete.includes(raw)) {
    return <p className="text-sm text-muted">No holdings for this month.</p>;
  }
  const month = raw;

  const cleaned = cleanChaseRows(await getChaseRows(month));
  const inflows = [...cleaned]
    .filter((r) => r.net_value_delta_cr > 0)
    .sort((a, b) => b.net_value_delta_cr - a.net_value_delta_cr)
    .slice(0, 3);
  const outflows = [...cleaned]
    .filter((r) => r.net_value_delta_cr < 0)
    .sort((a, b) => a.net_value_delta_cr - b.net_value_delta_cr)
    .slice(0, 3);
  const sectorTotals = new Map<string, number>();
  for (const r of cleaned) {
    const key = sectorLabel(r.sector);
    if (key === "Unknown") continue;
    sectorTotals.set(key, (sectorTotals.get(key) ?? 0) + r.net_value_delta_cr);
  }
  const leading = [...sectorTotals.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  const url = siteUrl(`/month/${month}`);
  const text = monthShareCaption({
    monthLabel: formatMonthLabel(month),
    inflows,
    outflows,
    url,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium">Adds & cuts · {formatMonthLabel(month)}</h1>
          <p className="mt-1 text-sm text-muted">
            Active equity, by share count. Price moves without extra buying do not count as a buy.
          </p>
        </div>
        <ShareBar title={`Adds & cuts · ${formatMonthLabel(month)}`} text={text} url={url} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-border bg-card p-3">
          <div className="text-xs uppercase tracking-[0.12em] text-faint">Top inflows</div>
          <ul className="mt-3 space-y-3">
            {inflows.map((r) => (
              <li key={r.stock_id}>
                <Link className="hover:underline" href={`/stocks/${r.stock_id}?month=${month}`}>
                  {r.display_name}
                </Link>
                <div className="mt-0.5 text-sm text-gain">+{formatNumber(r.net_value_delta_cr, 1)} ₹ cr</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded border border-border bg-card p-3">
          <div className="text-xs uppercase tracking-[0.12em] text-faint">Top outflows</div>
          <ul className="mt-3 space-y-3">
            {outflows.map((r) => (
              <li key={r.stock_id}>
                <Link className="hover:underline" href={`/stocks/${r.stock_id}?month=${month}`}>
                  {r.display_name}
                </Link>
                <div className="mt-0.5 text-sm text-loss">{formatNumber(r.net_value_delta_cr, 1)} ₹ cr</div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded border border-border bg-card p-3">
        <div className="text-xs uppercase tracking-[0.12em] text-faint">Sector signal</div>
        <div className="mt-2 text-base font-medium">
          {leading ? leading[0] : "—"}
        </div>
        <div className="mt-1 text-sm text-muted">
          {leading
            ? `${leading[1] > 0 ? "Net inflow" : "Net outflow"}: ${formatNumber(Math.abs(leading[1]), 1)} ₹ cr`
            : "No sector signal"}
        </div>
      </div>

      <p className="text-sm text-muted">
        <Link className="underline" href={`/adds-cuts?month=${month}`}>
          Full table
        </Link>
        {" · "}
        <a className="underline" href={SITE_URL}>
          www.thinkbrew.in
        </a>
      </p>
    </div>
  );
}
