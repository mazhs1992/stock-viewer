# Stock Viewer


Invite-only stock watchlist με AI ανάλυση (Claude), lognormal projections και accuracy tracking.

## Prerequisites

- **Node.js** >= 20
- **Python** >= 3.12
- **Docker Desktop** (για local Supabase)
- **Supabase CLI** (`npm i -g supabase`)

## Local Setup

```bash
# 1. Clone & install
cd app
npm install

# 2. Python pipeline venv
cd pipeline
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..

# 3. Start local Supabase
supabase start
# Σημείωσε τα ANON_KEY, SERVICE_ROLE_KEY, URL από το output

# 4. Environment
cp .env.example .env.local
# Συμπλήρωσε τα keys από το supabase start output:
#   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
#   SUPABASE_SERVICE_ROLE_KEY=...

# 5. Reset DB (migrations + seeds)
supabase db reset

# 6. (Προαιρετικά) Import legacy data
source pipeline/.venv/bin/activate
python scripts/import_legacy.py

# 7. Start dev server
npm run dev
# -> http://localhost:3000
```

## First Login

Το seed δημιουργεί invite για τον admin. Πήγαινε στο `http://localhost:3000/login`, κάνε register με το email που έβαλες στο seed (`baggos92maz@gmail.com`). Το confirmation email βρίσκεται στο local mailbox: `http://127.0.0.1:54324`.

## Pipeline

```bash
source pipeline/.venv/bin/activate

# Mock run (χωρίς API keys)
python -m pipeline --kind manual --ticker MU --mock

# Real run (χρειάζεται FINNHUB_API_KEY, TWELVEDATA_API_KEY, ANTHROPIC_API_KEY στο .env.local)
python -m pipeline --kind manual --ticker MU

# Full cron run
python -m pipeline --kind cron

# Ο δεύτερος cron run για την ίδια trading date βγαίνει "already done"
```

## Manual Trigger (UI)

Στη σελίδα `/runs`, ο admin μπορεί να πατήσει "Τρέξε τώρα". Με `TRIGGER_MODE=local` στο `.env.local`, τρέχει τo pipeline σαν child process.

## DB Backup

```bash
./scripts/dump_local.sh
# -> backups/local_YYYYMMDD_HHMMSS.sql
```

## Structure

```
app/
├── src/                  # Next.js app
│   ├── app/(app)/        # Authenticated pages (watchlist, dashboard, stocks, news, sources, runs, users)
│   ├── app/login/        # Login page
│   ├── app/api/          # API routes (trigger, runs)
│   ├── components/       # Shared components (nav, sparkline, fan-chart, theme)
│   └── lib/supabase/     # Supabase client helpers
├── pipeline/             # Python data pipeline
│   ├── collect/          # Finnhub, Twelve Data, market data, mock
│   ├── analyze/          # Claude analysis, prompts, mock
│   ├── compute/          # Projections (lognormal), accuracy
│   └── store/            # DB writers
├── supabase/
│   ├── migrations/       # 4 migration files (tables, RLS, triggers)
│   └── seed.sql          # Admin invite, 5 assets, 5 sources
├── scripts/
│   ├── import_legacy.py  # Legacy data import
│   └── dump_local.sh     # DB backup
└── legacy/data/          # Legacy JSON data (snapshots, days, stocks)
```

## Notes

- **Email/password login** λειτουργεί locally με Mailpit (`http://127.0.0.1:54324`).
- **Google login** ρυθμίζεται στο Phase 6 (deploy) -- χρειάζεται Google Cloud OAuth client.
- Για custom SMTP (email πέρα από localhost), ρύθμισε στο Supabase dashboard -> Auth -> SMTP.
- Η εφαρμογή είναι invite-only: μόνο emails στον πίνακα `invites` μπορούν να κάνουν register.
