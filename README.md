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

**No login.** Watchlist and compare selection stay in `localStorage`. The browser never calls FinAPI.

JSON for the UI is under `/api/v1` (holdings rows: `GET /api/v1/chase`).

## Setup

Empty [Supabase](https://supabase.com) project. Run these SQL files in the editor, **in this order**:

1. [`supabase/migrations/20260829000000_init.sql`](supabase/migrations/20260829000000_init.sql)
2. [`supabase/migrations/20260829010000_scheme_metrics.sql`](supabase/migrations/20260829010000_scheme_metrics.sql)
3. [`supabase/migrations/20260903000000_scheme_metrics_pe.sql`](supabase/migrations/20260903000000_scheme_metrics_pe.sql)
4. [`supabase/migrations/20260913000000_scheme_metrics_asset_class.sql`](supabase/migrations/20260913000000_scheme_metrics_asset_class.sql)

Copy [`.env.example`](.env.example) to `.env.local` and fill the keys (Supabase + `FINAPI_API_KEY`). Extra ingest knobs are documented there.

```bash
npm install
npm run ingest:metrics   # schemes first
npm run ingest           # then holdings
npm run dev              # http://localhost:3000
```

Metrics before holdings. First ingest takes a while.

## Deploy

Host the app on Vercel against the same Supabase project. Set the variables from `.env.example` in the Vercel project (at least the `NEXT_PUBLIC_SUPABASE_*` keys, `SUPABASE_SERVICE_ROLE_KEY`, and `FINAPI_API_KEY`).

## License

[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). See [LICENSE](LICENSE).

Non-commercial use only. If you change and redistribute this project, keep it under the same license and share the source. This is not an OSI Open Source license, because commercial use is not allowed.
