create table if not exists analytics_counters (
  key text primary key,
  count bigint not null default 0,
  updated_at timestamptz not null default now()
);
