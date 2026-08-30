# MF Chase

Open-source research cockpit for **monthly active-equity Indian mutual fund holdings**, plus a **fund screener and compare** (house, Sharpe, TER, CAGR).

Not a Groww/Value Research clone. Not investment advice.

## What v1 does

- **Chase:** monthly books — what funds added or cut (share quantity), crowding, sector rollups
- **Screener / Compare:** Direct Growth active-equity schemes, filter by fund house, Sharpe, expense ratio, returns
- Holdings ingest uses **FinAPI Pro** (server-side only): top schemes by AUM from `scheme_metrics`, monthly books
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
npm run ingest           # FinAPI → holdings (Chase); top 50 by AUM, 12 months
npm run dev              # http://localhost:3000
```

Open **Screener**, filter, tick 2–6 funds, then **Compare**. The browser never calls FinAPI.

Default holdings ingest is **50 funds** (`INGEST_HOLDINGS_LIMIT`) and **12 months** (`INGEST_HOLDINGS_MONTHS`). Requires `ingest:metrics` first. The old mfdata worker is `npm run ingest:mfdata` (usually 522).

## Deploy later

Same app on Vercel + hosted Supabase. Set the same env vars. Point a Flutter/RN client at `/api/v1`.

## License

MIT. See [LICENSE](LICENSE).
