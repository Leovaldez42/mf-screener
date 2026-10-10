import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Data sources · Thinkbrew",
  description:
    "Thinkbrew holdings and scheme metrics come from FinAPI month-end mutual fund disclosures. Not investment advice.",
  path: "/data-sources",
});

export default function DataSourcesPage() {
  return (
    <article className="space-y-6 text-sm leading-6 text-muted">
      <div>
        <h1 className="text-xl font-medium text-foreground">Data sources</h1>
        <p className="mt-2">
          Holdings snapshots and Direct Growth scheme metrics are ingested from FinAPI, which republishes AMC
          month-end portfolio disclosures and scheme factsheets. Thinkbrew does not scrape NSE/BSE filings itself.
        </p>
      </div>
      <section>
        <h2 className="text-base font-medium text-foreground">What we store</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>Month-end holdings for active-equity schemes we cover: stock, quantity, market value and weight.</li>
          <li>Scheme-level metrics used on fund pages (AUM, category, returns) from the same pipeline.</li>
        </ul>
      </section>
      <p>
        Ingest runs are listed on{" "}
        <Link className="text-accent hover:underline" href="/data">
          Data
        </Link>
        . Numbers can revise if an AMC restates a book.
      </p>
    </article>
  );
}
