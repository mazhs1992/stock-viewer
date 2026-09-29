-- Analysis tables: judgments, predictions, accuracy, runs + RLS

create type run_kind as enum ('cron', 'manual');
create type run_status as enum ('queued', 'running', 'ok', 'partial', 'failed');

create table runs (
  id            uuid primary key default gen_random_uuid(),
  kind          run_kind not null,
  scope         text not null default 'all',
  status        run_status not null default 'queued',
  trading_date  date,
  requested_by  uuid references auth.users(id),
  started_at    timestamptz,
  finished_at   timestamptz,
  tokens_in     int,
  tokens_out    int,
  cost_usd      numeric,
  log           jsonb,
  errors        jsonb
);

alter table runs enable row level security;

create table judgments (
  ticker     text not null references assets(ticker),
  date       date not null,
  run_id     uuid not null references runs(id),
  score      int not null check (score between -2 and 2),
  is_event   boolean not null default false,
  why        text,
  summary    text,
  sentiment  numeric check (sentiment between -1 and 1),
  importance int check (importance between 0 and 2),
  tags       text[] not null default '{}',
  primary key (ticker, date, run_id)
);

alter table judgments enable row level security;

create table predictions (
  ticker        text not null references assets(ticker),
  date          date not null,
  horizon       text not null,
  run_kind      run_kind not null,
  price0        numeric not null,
  bear          numeric not null,
  base          numeric not null,
  bull          numeric not null,
  vol           numeric,
  mu            numeric,
  score         int,
  model_version text not null default 'v1',
  run_id        uuid references runs(id),
  primary key (ticker, date, horizon, run_kind)
);

alter table predictions enable row level security;

-- Insert-only enforcement on predictions
create or replace function public.prevent_prediction_mutation()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.allow_prediction_mutation', true) = 'true' then
    return old;
  end if;
  raise exception 'predictions is insert-only: UPDATE and DELETE are not allowed'
    using errcode = 'P0002';
end;
$$;

create trigger predictions_no_update
  before update on predictions
  for each row
  execute function public.prevent_prediction_mutation();

create trigger predictions_no_delete
  before delete on predictions
  for each row
  execute function public.prevent_prediction_mutation();

create table accuracy (
  scope       text not null,
  horizon     text not null,
  win         text not null,
  n           int not null default 0,
  hit         numeric,
  mae         numeric,
  dir         numeric,
  above       int,
  below       int,
  last        date,
  first_due   date,
  computed_at timestamptz not null default now(),
  primary key (scope, horizon, win)
);

alter table accuracy enable row level security;

-- RLS: active users read all, service role writes
create policy "Active users can read runs"
  on runs for select
  using (
    exists (
      select 1 from profiles
      where profiles.user_id = auth.uid() and profiles.active = true
    )
  );

create policy "Active users can read judgments"
  on judgments for select
  using (
    exists (
      select 1 from profiles
      where profiles.user_id = auth.uid() and profiles.active = true
    )
  );

create policy "Active users can read predictions"
  on predictions for select
  using (
    exists (
      select 1 from profiles
      where profiles.user_id = auth.uid() and profiles.active = true
    )
  );

create policy "Active users can read accuracy"
  on accuracy for select
  using (
    exists (
      select 1 from profiles
      where profiles.user_id = auth.uid() and profiles.active = true
    )
  );
