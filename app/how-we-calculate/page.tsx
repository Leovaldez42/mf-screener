import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "How we calculate · Thinkbrew",
  description:
    "How Thinkbrew turns month-end mutual fund holdings disclosures into adds, cuts and the monthly report. Not investment advice.",
  path: "/how-we-calculate",
});

export default function HowWeCalculatePage() {
  return (
    <article className="space-y-6 text-sm leading-6 text-muted">
      <div>
        <h1 className="text-xl font-medium text-foreground">How we calculate</h1>
        <p className="mt-2">
          Thinkbrew reads month-end portfolio books for Indian active-equity funds. Adds and cuts are
          share-quantity changes between this month and the prior month, not moves in portfolio
          weight. A stock can rise in weight just because the price moved.
        </p>
      </div>
      <section>
        <h2 className="text-base font-medium text-foreground">What counts</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>Equity stocks in the book. Cash, TREPS, ETFs, fund units, REITs/InvITs and derivatives are dropped.</li>
          <li>
            Net bought (₹ cr) is share changes valued at this month&apos;s closing price (last
            month&apos;s price on a full exit). It excludes price moves, so a name funds sold does
            not show as bought if the stock only marked up.
          </li>
          <li>
            Funds with no prior-month book (a first disclosure) are excluded from month-on-month totals so the whole
            book is not treated as “bought.”
          </li>
          <li>
            AMCs typically publish about ten working days after month-end. Until then the latest month can still be
            missing a house.
          </li>
        </ul>
      </section>
      <p>
        More on sources:{" "}
        <Link className="text-accent hover:underline" href="/data-sources">
          Data sources
        </Link>
        . This is not investment advice — see the{" "}
        <Link className="text-accent hover:underline" href="/disclaimer">
          disclaimer
        </Link>
        .
      </p>
    </article>
  );
}
