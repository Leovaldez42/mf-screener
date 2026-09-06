import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description: "What MF Chase covers, where the holdings come from, and how to read the numbers.",
};

export default function AboutPage() {
  return (
    <article className="max-w-2xl space-y-8 text-sm leading-6 text-muted">
      <div>
        <h1 className="text-xl font-medium text-foreground">About</h1>
        <p className="mt-2">
          MF Chase is a research tool for Indian <strong className="font-medium text-foreground">active-equity</strong>{" "}
          mutual funds. It is not a broker, not a recommendation engine, and not investment advice.
        </p>
      </div>

      <section>
        <h2 className="text-base font-medium text-foreground">What is in here</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            <Link className="text-foreground underline" href="/adds-cuts">
              Adds & cuts
            </Link>{" "}
            — stocks funds bought more of or sold between monthly portfolio books, by share count.
          </li>
          <li>
            <Link className="text-foreground underline" href="/screener">
              Screener
            </Link>{" "}
            and{" "}
            <Link className="text-foreground underline" href="/compare">
              Compare
            </Link>{" "}
            — Direct Growth plans only, with Sharpe, TER, PE, and CAGR.
          </li>
          <li>Index funds, ETFs, gold, and debt are skipped.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-medium text-foreground">How to read holdings</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            AMCs publish books about <strong className="font-medium text-foreground">ten working days</strong> after
            month-end. Until then the table shows the last complete month.
          </li>
          <li>
            Adds and cuts are <strong className="font-medium text-foreground">shares</strong>, not portfolio weight. A
            stock can rise in weight just because the price moved.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-medium text-foreground">Source</h2>
        <p className="mt-2">
          Holdings and scheme metrics come from FinAPI (top funds by AUM). There is no login. Watchlists stay in this
          browser.
        </p>
      </section>

      <section>
        <h2 className="text-base font-medium text-foreground">License</h2>
        <p className="mt-2">
          Source-available under{" "}
          <a className="underline" href="https://creativecommons.org/licenses/by-nc-sa/4.0/">
            CC BY-NC-SA 4.0
          </a>
          : non-commercial use only; modified versions must stay under the same license. Not affiliated with AMFI or
          any AMC.
        </p>
      </section>
    </article>
  );
}
