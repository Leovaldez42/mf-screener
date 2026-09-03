# MF Chase

Source-available research cockpit for **monthly active-equity Indian mutual fund holdings**, plus a **fund screener and compare** (house, Sharpe, TER, CAGR).

Not a Groww/Value Research clone. Not investment advice.

## What v1 does

- **Chase:** monthly books — what funds added or cut (share quantity), crowding, sector rollups
- **Screener / Compare:** Direct Growth active-equity schemes, filter by fund house, Sharpe, expense ratio, returns
- Holdings ingest uses **FinAPI Pro** (server-side only): all Direct Growth active-equity schemes in `scheme_metrics`, monthly books
- Screener / Compare metrics also from FinAPI
- Localhost web UI + JSON at `/api/v1` (for a future mobile app)
- **No login.** Watchlist and compare selection are `localStorage`

Holdings land about **ten working days after month-end**. Metrics refresh can run more often than holdings.

## Setup

1. Create a [Supabase](https://supabase.com) project.
2. Run both SQL files in the editor, in order:
   - [`supabase/migrations/20260829000000_init.sql`](supabase/migrations/20260829000000_init.sql)
   - [`supabase/migrations/20260829010000_scheme_metrics.sql`](supabase/migrations/20260829010000_scheme_metrics.sql)
3. Copy [`.env.example`](.env.example) to `.env.local` and fill keys (including `FINAPI_API_KEY` for metrics).
4. Install and run:

```bash
cd ~/dev/mf-chase
npm install
npm run ingest:metrics   # FinAPI → scheme_metrics (screener)
npm run ingest           # FinAPI → holdings for every screener scheme, 12 months
npm run dev              # http://localhost:3000
```

Open **Screener**, filter by category / house / Sharpe / TER / returns. When a category is selected, a single equal-weight peer average strip appears at the top. Open a scheme page for the same averages vs that fund. Compare from **Compare**. Watchlist is browser-local. The browser never calls FinAPI.

Ingest status for operators is at `/data` (not in the nav).

Default holdings ingest is **all** Direct Growth active-equity schemes in `scheme_metrics` (`INGEST_HOLDINGS_LIMIT=0`) and **12 months**. Already-ingested funds are skipped unless `INGEST_HOLDINGS_SKIP_EXISTING=0`. Requires `ingest:metrics` first. The old mfdata worker is `npm run ingest:mfdata`.

Months in the Chase dropdown are whatever exists in Supabase snapshots/aggregates. If FinAPI has no older books, a retry will not invent them.

## Deploy later

Same app on Vercel + hosted Supabase. Set the same env vars. Point a Flutter/RN client at `/api/v1`.

## License

[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). See [LICENSE](LICENSE).

Non-commercial use only. If you change and redistribute this project, you must keep it under the same license and share the source. This is not an OSI Open Source license, because commercial use is not allowed.
