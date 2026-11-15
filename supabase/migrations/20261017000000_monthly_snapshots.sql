-- Precomputed monthly JSON. Public read; writes via service role (npm run snapshots).
-- Holdings books are monthly; pages read these rows instead of recomputing MoM per request.

create table public.report_snapshot (
  month text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.fund_snapshot (
  family_id bigint not null references public.families (id) on delete cascade,
  month text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (family_id, month)
);

create table public.stock_snapshot (
  stock_id uuid not null references public.stocks (id) on delete cascade,
  month text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (stock_id, month)
);

create table public.site_snapshot (
  key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index fund_snapshot_month_idx on public.fund_snapshot (month);
create index stock_snapshot_month_idx on public.stock_snapshot (month);

alter table public.report_snapshot enable row level security;
alter table public.fund_snapshot enable row level security;
alter table public.stock_snapshot enable row level security;
alter table public.site_snapshot enable row level security;

create policy report_snapshot_read on public.report_snapshot for select using (true);
create policy fund_snapshot_read on public.fund_snapshot for select using (true);
create policy stock_snapshot_read on public.stock_snapshot for select using (true);
create policy site_snapshot_read on public.site_snapshot for select using (true);
