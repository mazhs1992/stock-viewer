-- Assets (shared watchlist) and sources tables + RLS

create type source_kind as enum ('api', 'site');

create table sources (
  id            serial primary key,
  name          text not null unique,
  kind          source_kind not null,
  base_url      text,
  provides      text[] not null default '{}',
  priority      int not null default 100,
  enabled       boolean not null default true,
  notes         text,
  last_ok_at    timestamptz,
  last_error    text,
  last_error_at timestamptz
);

alter table sources enable row level security;

create table assets (
  ticker       text primary key,
  name         text not null,
  sector       text not null,
  currency     text not null default 'USD',
  exchange     text not null default 'NASDAQ',
  limited      boolean not null default false,
  vol_override numeric,
  active       boolean not null default true,
  added_by     uuid references auth.users(id),
  updated_by   uuid references auth.users(id),
  updated_at   timestamptz not null default now()
);

alter table assets enable row level security;

-- RLS: active users read, member+admin write assets, admin writes sources
create policy "Active users can read sources"
  on sources for select
  using (
    exists (
      select 1 from profiles
      where profiles.user_id = auth.uid() and profiles.active = true
    )
  );

create policy "Admins can manage sources"
  on sources for all
  using (
    exists (
      select 1 from profiles
      where profiles.user_id = auth.uid() and profiles.role = 'admin' and profiles.active = true
    )
  );

create policy "Active users can read assets"
  on assets for select
  using (
    exists (
      select 1 from profiles
      where profiles.user_id = auth.uid() and profiles.active = true
    )
  );

create policy "Members and admins can manage assets"
  on assets for all
  using (
    exists (
      select 1 from profiles
      where profiles.user_id = auth.uid() and profiles.active = true
    )
  );
