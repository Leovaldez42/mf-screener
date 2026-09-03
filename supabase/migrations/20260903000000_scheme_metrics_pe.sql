-- Portfolio PE from FinAPI fundamentals.pe. Category average is computed in the app
-- as equal-weight mean of Direct Growth peers (same as Sharpe / TER).

alter table public.scheme_metrics
  add column if not exists pe numeric;
