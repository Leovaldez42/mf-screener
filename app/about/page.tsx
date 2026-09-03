export default function AboutPage() {
  return (
    <article className="max-w-2xl space-y-4 text-sm leading-6 text-muted">
      <h1 className="text-xl font-medium text-foreground">About</h1>
      <p>
        MF Chase is a research view of <strong>what active Indian equity mutual funds added or cut</strong>{" "}
        between monthly portfolio disclosures, plus a <strong>fund screener and compare</strong> for
        Sharpe, TER, and returns. It is not investment advice.
      </p>
      <p>
        Holdings are published about <strong>ten working days after month-end</strong>. Until then, Chase
        uses the last complete book — an empty month is not treated as funds selling everything.
      </p>
      <p>
        Holdings ingest uses FinAPI Pro (top funds by AUM, monthly books). Scheme metrics (screener)
        also come from FinAPI, stored in Supabase. Index funds, ETFs, gold, and debt are skipped.
        Direct Growth is the canonical plan for compare.
      </p>
      <p>
        v1 has no login. Watchlists stay in <code>localStorage</code>. Auth can be added later without changing
        Chase. The JSON under <code>/api/v1</code> is meant for a future mobile client.
      </p>
      <p>
        Licensed under{" "}
        <a className="underline" href="https://creativecommons.org/licenses/by-nc-sa/4.0/">
          CC BY-NC-SA 4.0
        </a>
        : non-commercial use only; modified versions must stay under the same license. Not affiliated with AMFI or any
        AMC.
      </p>
    </article>
  );
}
