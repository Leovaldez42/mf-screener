# Thinkbrew

Research tool for **Indian mutual funds**: monthly adds and cuts for active-equity books (by share count), plus a fund screener and compare across classes.

Not a broker. Not investment advice.

## Product

- **`/`** — home
- **Adds & cuts** (`/adds-cuts`) — what active-equity funds bought or sold between monthly books, by share count
- **Screener** (`/screener`) and **Compare** (`/compare`) — Direct Growth plans by class
- **Sectors** (`/sectors`)
- **Watchlist** (`/watchlist`) — this browser only
- **Portfolio** (`/portfolio`) — soon
- **About** (`/about`)

AMC books land about **ten working days after month-end**. Adds and cuts are **share quantity**, not portfolio weight.

**No login.** Watchlist and compare selection stay in `localStorage`. The browser never calls EJI API.

Holdings on the site are credited as “Data: EJI API”. The monthly holdings files stay on the machine that runs ingest. Do not commit them, and do not add a download of every fund’s book. Pages show one fund, one stock, or the month’s adds and cuts.

## Setup

Empty [Supabase](https://supabase.com) project. Run these SQL files in the editor, **in this order**:

1. [`supabase/migrations/20260829000000_init.sql`](supabase/migrations/20260829000000_init.sql)
2. [`supabase/migrations/20260829010000_scheme_metrics.sql`](supabase/migrations/20260829010000_scheme_metrics.sql)
3. [`supabase/migrations/20260903000000_scheme_metrics_pe.sql`](supabase/migrations/20260903000000_scheme_metrics_pe.sql)
4. [`supabase/migrations/20260913000000_scheme_metrics_asset_class.sql`](supabase/migrations/20260913000000_scheme_metrics_asset_class.sql)
5. [`supabase/migrations/20261017000000_monthly_snapshots.sql`](supabase/migrations/20261017000000_monthly_snapshots.sql)

Copy [`.env.example`](.env.example) to `.env.local` and fill the keys (Supabase + `FINAPI_API_KEY`). Extra ingest knobs are documented there.

```bash
npm install
npm run ingest:metrics   # schemes first
npm run ingest           # then holdings
npm run snapshots        # precompute monthly JSON (report, funds, stocks, search index)
npm run dev              # http://localhost:3000
```

Metrics before holdings. First ingest takes a while.

Each month, once AMC books are out, run **`npm run refresh`**. It re-fetches the latest month and the one before it, then runs `npm run snapshots`, which writes `report_snapshot`, `fund_snapshot`, `stock_snapshot`, and `site_snapshot` in Supabase plus `public/search-index.json`, and finally revalidates the `holdings` cache tag. Pages and holdings APIs read those rows; they do not recompute month-on-month at request time. Holdings pages revalidate every 30 days as a backstop, so the tag call is what makes new data show up: set `APP_URL` to the deployed site and the same `REVALIDATE_SECRET` locally and on Vercel. Apply [`supabase/migrations/20261017000000_monthly_snapshots.sql`](supabase/migrations/20261017000000_monthly_snapshots.sql) once before the first snapshot run. If a page logs `[snapshot] … missing; computing live`, snapshots are stale or missing for that month.

## Deploy

Host the app on Vercel against the same Supabase project. Set the variables from `.env.example` in the Vercel project (at least the `NEXT_PUBLIC_SUPABASE_*` keys, `SUPABASE_SERVICE_ROLE_KEY`, and `FINAPI_API_KEY`).

## License

[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). See [LICENSE](LICENSE).

Non-commercial use only. If you change and redistribute this project, keep it under the same license and share the source. This is not an OSI Open Source license, because commercial use is not allowed.
