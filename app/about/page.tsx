export default function AboutPage() {
  return (
    <article className="max-w-2xl space-y-4 text-sm leading-6 text-zinc-300">
      <h1 className="text-xl font-medium text-zinc-100">About</h1>
      <p>
        MF Chase is a research view of <strong>what active Indian equity mutual funds added or cut</strong>{" "}
        between monthly portfolio disclosures, plus a <strong>fund screener and compare</strong> for
        Sharpe, TER, and returns. It is not investment advice.
      </p>
      <p>
        Holdings are published about <strong>ten working days after month-end</strong>. Quantity change is
        the buy/sell signal; weight can move with price even if shares do not. Rupee change can also move
        with category inflows (AUM floods).
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
      <p>MIT licensed. Not affiliated with AMFI or any AMC.</p>
    </article>
  );
}
