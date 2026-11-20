-- Durable per-owner workspace snapshot. The browser keeps a local cache,
-- while this row is the source of truth shared across devices.
create table if not exists app_state (
  user_id text primary key,
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists app_state_updated_at_idx on app_state (updated_at);
