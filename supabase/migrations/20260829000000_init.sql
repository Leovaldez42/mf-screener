-- Research tables. Public read (no auth in v1). Writes via service role (ingest).
-- Later: watchlists with user_id + RLS; keep public read on these tables.

create extension if not exists "pgcrypto";

create table public.ingest_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'mfdata',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'partial', 'failed')),
  months text[] not null default '{}',
  families_ok integer not null default 0,
  families_fail integer not null default 0,
  notes text
);

create table public.amcs (
  slug text primary key,
  name text not null
);

create table public.families (
  id bigint primary key,
  name text not null,
  amc_slug text references public.amcs (slug),
  sebi_category text,
  is_active_equity boolean not null default false,
  has_holdings boolean not null default false,
  latest_month text
);

create table public.stocks (
  id uuid primary key default gen_random_uuid(),
  isin text unique,
  display_name text not null,
  name_key text not null,
  sector text not null default '',
  unique (name_key, sector)
);

create table public.holdings_snapshots (
  family_id bigint not null references public.families (id) on delete cascade,
  month text not null,
  stock_id uuid not null references public.stocks (id),
  quantity numeric not null default 0,
  market_value_cr numeric not null default 0,
  weight_pct numeric not null default 0,
  primary key (family_id, month, stock_id)
);

create table public.holding_diffs (
  family_id bigint not null references public.families (id) on delete cascade,
  month text not null,
  stock_id uuid not null references public.stocks (id),
  qty_delta numeric not null default 0,
  weight_delta numeric not null default 0,
  value_delta_cr numeric not null default 0,
  event text not null check (event in ('new', 'exit', 'add', 'cut', 'hold')),
  primary key (family_id, month, stock_id)
);

create table public.stock_month_aggregates (
  stock_id uuid not null references public.stocks (id) on delete cascade,
  month text not null,
  fund_count integer not null default 0,
  fund_count_delta integer not null default 0,
  net_qty_delta numeric not null default 0,
  net_value_delta_cr numeric not null default 0,
  median_weight_pct numeric,
  primary key (stock_id, month)
);

create index holdings_snapshots_month_idx on public.holdings_snapshots (month);
create index holdings_snapshots_stock_month_idx on public.holdings_snapshots (stock_id, month);
create index holding_diffs_month_idx on public.holding_diffs (month);
create index holding_diffs_stock_month_idx on public.holding_diffs (stock_id, month);
create index stock_month_aggregates_month_idx on public.stock_month_aggregates (month);
create index families_category_idx on public.families (sebi_category);

alter table public.ingest_runs enable row level security;
alter table public.amcs enable row level security;
alter table public.families enable row level security;
alter table public.stocks enable row level security;
alter table public.holdings_snapshots enable row level security;
alter table public.holding_diffs enable row level security;
alter table public.stock_month_aggregates enable row level security;

create policy ingest_runs_read on public.ingest_runs for select using (true);
create policy amcs_read on public.amcs for select using (true);
create policy families_read on public.families for select using (true);
create policy stocks_read on public.stocks for select using (true);
create policy holdings_snapshots_read on public.holdings_snapshots for select using (true);
create policy holding_diffs_read on public.holding_diffs for select using (true);
create policy stock_month_aggregates_read on public.stock_month_aggregates for select using (true);
