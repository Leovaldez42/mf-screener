# MF Chase

Research tool for **Indian active-equity mutual funds**: monthly adds and cuts (by share count), plus a fund screener and compare.

Not a broker. Not investment advice. Index funds, ETFs, gold, and debt are skipped.

## Product

- **`/`** — landing
- **Adds & cuts** (`/adds-cuts`) — what funds bought more of or sold between monthly books. `/chase` redirects here.
- **Screener / Compare** — Direct Growth plans; filter and compare by house, Sharpe, PE, TER, CAGR
- **Sectors / Watchlist / About**
- Holdings land about **ten working days after month-end**. Until then the table shows the last complete book. Adds and cuts are shares, not weight.
- **No login.** Watchlist and compare selection stay in `localStorage`. The browser never calls FinAPI.

JSON for the UI (and anything else) is under `/api/v1`. Holdings rows are still `GET /api/v1/chase`.

## Setup

1. Create a [Supabase](https://supabase.com) project.
2. Run the SQL files in the editor, in order:
   - [`supabase/migrations/20260829000000_init.sql`](supabase/migrations/20260829000000_init.sql)
   - [`supabase/migrations/20260829010000_scheme_metrics.sql`](supabase/migrations/20260829010000_scheme_metrics.sql)
   - [`supabase/migrations/20260903000000_scheme_metrics_pe.sql`](supabase/migrations/20260903000000_scheme_metrics_pe.sql) (adds `pe`; existing projects only need this file)
3. Copy [`.env.example`](.env.example) to `.env.local` and fill keys (including `FINAPI_API_KEY`).
4. Install and run:

```bash
npm install
npm run ingest:metrics   # FinAPI → scheme_metrics (screener)
npm run ingest           # FinAPI → holdings for every screener scheme, 12 months
npm run dev              # http://localhost:3000
```

Default holdings ingest is **all** Direct Growth active-equity schemes in `scheme_metrics` (`INGEST_HOLDINGS_LIMIT=0`) and **12 months**. Already-ingested funds are skipped unless `INGEST_HOLDINGS_SKIP_EXISTING=0`. Requires `ingest:metrics` first. The old mfdata worker is `npm run ingest:mfdata`.

Months in the Holdings as of dropdown are whatever exists in Supabase snapshots/aggregates. If FinAPI has no older books, a retry will not invent them.

Ingest status for operators is at `/data` (not in the nav).

## Deploy

Same app on Vercel + hosted Supabase. Set the same env vars.

## License

[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). See [LICENSE](LICENSE).

Non-commercial use only. If you change and redistribute this project, you must keep it under the same license and share the source. This is not an OSI Open Source license, because commercial use is not allowed.
