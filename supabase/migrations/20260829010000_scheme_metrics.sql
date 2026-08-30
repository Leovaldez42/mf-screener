-- Canonical Direct Growth (and other plans) metrics for screener + compare.
-- Holdings remain on families; this table is independent so compare works before Chase ingest.

create table public.scheme_metrics (
  scheme_code text primary key,
  name text not null,
  fund_house text not null default '',
  amc_slug text not null default '',
  category text not null default '',
  plan_name text,
  option_name text,
  is_direct boolean not null default false,
  is_growth boolean not null default false,
  is_active_equity boolean not null default false,
  aum_cr numeric,
  expense_ratio numeric,
  sharpe_1y numeric,
  sharpe_3y numeric,
  sharpe_5y numeric,
  sortino_3y numeric,
  std_dev_3y numeric,
  beta_3y numeric,
  cagr_1y numeric,
  cagr_3y numeric,
  cagr_5y numeric,
  cagr_7y numeric,
  cagr_10y numeric,
  cagr_inception numeric,
  fetched_at timestamptz not null default now()
);

create index scheme_metrics_house_idx on public.scheme_metrics (fund_house);
create index scheme_metrics_filter_idx on public.scheme_metrics (is_active_equity, is_direct, is_growth);
create index scheme_metrics_sharpe_idx on public.scheme_metrics (sharpe_3y);
create index scheme_metrics_er_idx on public.scheme_metrics (expense_ratio);
create index scheme_metrics_cagr3_idx on public.scheme_metrics (cagr_3y);

alter table public.scheme_metrics enable row level security;
create policy scheme_metrics_read on public.scheme_metrics for select using (true);
