-- Asset class for the all-types screener. Holdings ingest still uses is_active_equity.

alter table public.scheme_metrics
  add column if not exists asset_class text not null default 'other';

update public.scheme_metrics
set asset_class = case
  when is_active_equity then 'equity-active'
  when lower(category) ~ 'index|etf|exchange traded' then 'index'
  when lower(category) ~ 'overnight|liquid|money market|ultra short|low duration|short duration|medium duration|long duration|dynamic bond|corporate bond|credit risk|banking and psu|banking & psu|gilt|floater|debt fund|debt scheme'
    or (lower(category) like '%bond%' and lower(category) not like '%index%') then 'debt'
  when lower(category) ~ 'hybrid|balanced|arbitrage|fund of fund|fof|equity savings|multi asset|dynamic asset' then 'hybrid'
  when lower(category) ~ 'gold|silver|international|overseas|retirement|children|solution' then 'other'
  else 'other'
end
where asset_class = 'other';

create index if not exists scheme_metrics_asset_class_idx
  on public.scheme_metrics (asset_class, is_direct, is_growth);
