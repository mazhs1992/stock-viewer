-- Seed data: initial assets, sources, and admin invite

-- Admin invite (first user bootstrap)
insert into invites (email, role, created_at)
values ('baggos92maz@gmail.com', 'admin', now())
on conflict (email) do nothing;

-- Initial watchlist assets
insert into assets (ticker, name, sector, currency, exchange) values
  ('MU',   'Micron Technology',       'Μνήμες',       'USD', 'NASDAQ'),
  ('NVDA', 'NVIDIA',                  'Ημιαγωγοί',    'USD', 'NASDAQ'),
  ('AMD',  'Advanced Micro Devices',  'Ημιαγωγοί',    'USD', 'NASDAQ'),
  ('MSFT', 'Microsoft',               'Τεχνολογία',   'USD', 'NASDAQ'),
  ('AAPL', 'Apple',                   'Τεχνολογία',   'USD', 'NASDAQ')
on conflict (ticker) do nothing;

-- Data sources
insert into sources (name, kind, base_url, provides, priority, enabled, notes) values
  ('Finnhub',            'api',  'https://finnhub.io/api/v1',
   array['quote', 'news', 'analysts', 'earnings'], 10, true,
   'Free tier: 60 calls/min'),
  ('Twelve Data',        'api',  'https://api.twelvedata.com',
   array['closes', 'quote'], 20, true,
   'Free tier: 800 credits/day, 8/min'),
  ('stockanalysis.com',  'site', 'https://stockanalysis.com',
   array['closes', 'analysts', 'quote'], 100, true,
   'Scraping fallback — may block datacenter IPs'),
  ('CNN Fear & Greed',   'api',  'https://production.dataviz.cnn.io/index/fearandgreed/graphdata',
   array['market'], 10, true,
   'Unofficial endpoint — may change without notice'),
  ('Claude Web Search',  'api',  null,
   array['market'], 20, true,
   'Market wrap: VIX, 10y, week-ahead events via Claude web search')
on conflict (name) do nothing;
