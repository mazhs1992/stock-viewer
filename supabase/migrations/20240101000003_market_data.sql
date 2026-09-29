-- Market data tables: prices, fundamentals, news, market daily + RLS

create table prices_daily (
  ticker     text not null references assets(ticker),
  date       date not null,
  close      numeric not null,
  source_id  int references sources(id),
  fetched_at timestamptz not null default now(),
  primary key (ticker, date)
);

alter table prices_daily enable row level security;

create table fundamentals_daily (
  ticker        text not null references assets(ticker),
  date          date not null,
  price         numeric,
  chg_pct       numeric,
  low52         numeric,
  high52        numeric,
  beta          numeric,
  pe            numeric,
  fpe           numeric,
  rating        numeric,
  target        numeric,
  analysts      int,
  next_earnings date,
  source_ids    jsonb not null default '{}',
  fetched_at    timestamptz not null default now(),
  primary key (ticker, date)
);

alter table fundamentals_daily enable row level security;

create table news_items (
  id           serial primary key,
  ticker       text not null references assets(ticker),
  date         date not null,
  title        text not null,
  source_name  text,
  url          text not null unique,
  published_at timestamptz,
  snippet      text,
  fetched_body boolean not null default false
);

alter table news_items enable row level security;

create index idx_news_items_ticker_date on news_items(ticker, date);

create table market_daily (
  date                 date primary key,
  fear_greed           numeric,
  fear_greed_label     text,
  fear_greed_prev_week numeric,
  vix                  numeric,
  us10y                numeric,
  mood                 text,
  summary              text,
  market_note          text,
  notes                text,
  week_events          jsonb
);

alter table market_daily enable row level security;

-- RLS: active users read, service role writes (default — no user write policies)
create policy "Active users can read prices_daily"
  on prices_daily for select
  using (
    exists (
      select 1 from profiles
      where profiles.user_id = auth.uid() and profiles.active = true
    )
  );

create policy "Active users can read fundamentals_daily"
  on fundamentals_daily for select
  using (
    exists (
      select 1 from profiles
      where profiles.user_id = auth.uid() and profiles.active = true
    )
  );

create policy "Active users can read news_items"
  on news_items for select
  using (
    exists (
      select 1 from profiles
      where profiles.user_id = auth.uid() and profiles.active = true
    )
  );

create policy "Active users can read market_daily"
  on market_daily for select
  using (
    exists (
      select 1 from profiles
      where profiles.user_id = auth.uid() and profiles.active = true
    )
  );
