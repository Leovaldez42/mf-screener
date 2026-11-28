import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Data sources · Thinkbrew",
  description:
    "Thinkbrew holdings come from the EJI API monthly holdings file. Scheme metrics come from EJI API. Not investment advice.",
  path: "/data-sources",
});

export default function DataSourcesPage() {
  return (
    <article className="space-y-6 text-sm leading-6 text-muted">
      <div>
        <h1 className="text-xl font-medium text-foreground">Data sources</h1>
        <p className="mt-2">
          Holdings come from the EJI API monthly holdings file, which republishes AMC month-end portfolio disclosures.
          Thinkbrew keeps the active-equity books and shows the results on this site. Scheme metrics (AUM, category,
          returns, expense ratio) come from EJI API scheme data. Thinkbrew does not scrape NSE/BSE filings itself.
        </p>
      </div>
      <section>
        <h2 className="text-base font-medium text-foreground">What we store</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>Month-end holdings for active-equity schemes we cover: stock, quantity, market value and weight.</li>
          <li>Scheme-level metrics used on fund pages (AUM, category, returns) from the same provider.</li>
        </ul>
      </section>
      <section>
        <h2 className="text-base font-medium text-foreground">What we do not publish</h2>
        <p className="mt-2">
          The monthly holdings file stays out of the public repository. This site does not offer a download of that
          file, or of the holdings of every fund. A page shows one fund, one stock, or the month&apos;s adds and cuts.
        </p>
      </section>
      <p>
        Ingest runs are listed on{" "}
        <Link className="text-accent hover:underline" href="/data">
          Data
        </Link>
        . Numbers can revise if an AMC restates a book.
      </p>
      <p className="text-faint">Data: EJI API</p>
    </article>
  );
}
