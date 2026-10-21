-- Backend-only cache for public TCGCSV feeds. No inventory or user data.
create table if not exists public.price_feed_cache (
  resource text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  source_updated_at timestamptz
);
alter table public.price_feed_cache enable row level security;
revoke all on public.price_feed_cache from public, anon, authenticated;
grant select, insert, update, delete on public.price_feed_cache to service_role;
