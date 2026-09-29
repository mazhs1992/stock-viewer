"""Import legacy data into the local Supabase database.

Usage: python scripts/import_legacy.py [--supabase-url URL] [--supabase-key KEY]

Imports from legacy/data/:
  - snapshots/*.json → predictions (run_kind='cron', model_version='v0') + prices_daily
  - days/*.json → judgments + news_items + market_daily.market_note
  - stocks/*.json → fundamentals_daily + prices_daily (spark closes)

Only imports tickers that exist in the assets table.
Idempotent: uses ON CONFLICT DO NOTHING.
"""
import argparse
import datetime as dt
import json
import os
import sys
import uuid

# Try to import supabase client
try:
    from supabase import create_client, Client
except ImportError:
    print("Install supabase-py: pip install supabase")
    sys.exit(1)

LEGACY_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "legacy", "data")


def get_client(url: str, key: str) -> Client:
    return create_client(url, key)


def load_assets(client: Client) -> set[str]:
    """Get active tickers from assets table."""
    resp = client.table("assets").select("ticker").execute()
    return {r["ticker"] for r in resp.data}


def nyse_trading_dates_backwards(as_of: str, count: int) -> list[str]:
    """Generate trading dates backwards from as_of (inclusive).

    Simple heuristic: skip weekends. For exact NYSE holidays,
    we'd need pandas_market_calendars, but this is close enough for legacy import.
    """
    d = dt.date.fromisoformat(as_of)
    dates = []
    while len(dates) < count:
        if d.weekday() < 5:  # Mon-Fri
            dates.append(d.isoformat())
        d -= dt.timedelta(days=1)
    return dates


def import_snapshots(client: Client, assets: set[str]):
    """Import snapshots/*.json → predictions + prices_daily."""
    snap_dir = os.path.join(LEGACY_DIR, "snapshots")
    if not os.path.isdir(snap_dir):
        print(f"  No snapshots directory: {snap_dir}")
        return

    for fname in sorted(os.listdir(snap_dir)):
        if not fname.endswith(".json"):
            continue
        path = os.path.join(snap_dir, fname)
        raw = json.load(open(path))
        raw = raw.get("data", raw)  # tolerate wrapped docs
        snap_date = raw.get("date") or fname.replace(".json", "")

        # Create a synthetic run for this snapshot
        run_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"legacy-snapshot-{snap_date}"))
        client.table("runs").upsert({
            "id": run_id,
            "kind": "cron",
            "scope": "all",
            "status": "ok",
            "trading_date": snap_date,
            "started_at": f"{snap_date}T22:30:00Z",
            "finished_at": f"{snap_date}T22:31:00Z",
        }).execute()

        predictions = []
        prices = []
        for ticker, a in raw.get("assets", {}).items():
            if ticker not in assets:
                continue
            p = a.get("p")
            if not p:
                continue

            # prices_daily from snapshot price
            prices.append({
                "ticker": ticker,
                "date": snap_date,
                "close": p,
            })

            score = a.get("score", 0)
            for horizon in ("d1", "w1", "m1", "m3", "m6"):
                proj = a.get(horizon)
                if not isinstance(proj, dict):
                    continue
                predictions.append({
                    "ticker": ticker,
                    "date": snap_date,
                    "horizon": horizon,
                    "run_kind": "cron",
                    "price0": p,
                    "bear": proj["bear"],
                    "base": proj["base"],
                    "bull": proj["bull"],
                    "score": score,
                    "model_version": "v0",
                    "run_id": run_id,
                })

        if prices:
            client.table("prices_daily").upsert(
                prices, on_conflict="ticker,date"
            ).execute()
        if predictions:
            # predictions is insert-only — use ignoreDuplicates
            client.table("predictions").upsert(
                predictions,
                on_conflict="ticker,date,horizon,run_kind",
                ignore_duplicates=True,
            ).execute()
        print(f"  snapshot {snap_date}: {len(predictions)} predictions, {len(prices)} prices")


def import_days(client: Client, assets: set[str]):
    """Import days/*.json → judgments + news_items + market_daily."""
    days_dir = os.path.join(LEGACY_DIR, "days")
    if not os.path.isdir(days_dir):
        print(f"  No days directory: {days_dir}")
        return

    for fname in sorted(os.listdir(days_dir)):
        if not fname.endswith(".json"):
            continue
        path = os.path.join(days_dir, fname)
        raw = json.load(open(path))
        day_date = raw.get("date") or fname.replace(".json", "")

        # Find or create a run for this date
        run_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"legacy-snapshot-{day_date}"))

        # Market daily
        market_note = raw.get("marketNote", "")
        if market_note:
            client.table("market_daily").upsert(
                {"date": day_date, "market_note": market_note},
                on_conflict="date",
            ).execute()

        judgments = []
        news = []
        for ticker, item in raw.get("items", {}).items():
            if ticker not in assets:
                continue

            # Judgment
            judgments.append({
                "ticker": ticker,
                "date": day_date,
                "run_id": run_id,
                "score": 0,  # days file doesn't have score, use 0
                "summary": item.get("summary", ""),
                "sentiment": item.get("sentiment", 0),
                "importance": item.get("importance", 0),
                "tags": item.get("tags", []),
            })

            # News items from headlines
            for h in item.get("headlines", []):
                url = h.get("url", "")
                if not url:
                    continue
                news.append({
                    "ticker": ticker,
                    "date": day_date,
                    "title": h.get("t", ""),
                    "source_name": h.get("src", ""),
                    "url": url,
                    "snippet": "",
                })

        if judgments:
            client.table("judgments").upsert(
                judgments, on_conflict="ticker,date,run_id"
            ).execute()
        if news:
            # Insert one at a time to handle url conflicts gracefully
            for n in news:
                try:
                    client.table("news_items").upsert(
                        n, on_conflict="url"
                    ).execute()
                except Exception:
                    pass  # duplicate url, skip

        print(f"  day {day_date}: {len(judgments)} judgments, {len(news)} news items")


def import_stocks(client: Client, assets: set[str]):
    """Import stocks/*.json → fundamentals_daily + prices_daily (spark closes)."""
    stocks_dir = os.path.join(LEGACY_DIR, "stocks")
    if not os.path.isdir(stocks_dir):
        print(f"  No stocks directory: {stocks_dir}")
        return

    for fname in sorted(os.listdir(stocks_dir)):
        if not fname.endswith(".json"):
            continue
        ticker = fname.replace(".json", "")
        if ticker not in assets:
            continue

        path = os.path.join(stocks_dir, fname)
        raw = json.load(open(path))
        as_of = raw.get("asOf")
        if not as_of:
            print(f"  stock {ticker}: no asOf, skipping")
            continue

        # Fundamentals
        fund = {
            "ticker": ticker,
            "date": as_of,
            "price": raw.get("price"),
            "chg_pct": raw.get("chgPct"),
            "low52": raw.get("low52"),
            "high52": raw.get("high52"),
            "beta": raw.get("beta"),
            "pe": raw.get("pe"),
            "fpe": raw.get("fpe"),
            "rating": None,  # rating is text in legacy ("Strong Buy"), but numeric in schema
            "target": raw.get("target"),
            "analysts": raw.get("analysts"),
            "next_earnings": raw.get("nextEarnings"),
        }
        client.table("fundamentals_daily").upsert(
            fund, on_conflict="ticker,date"
        ).execute()

        # Spark closes → prices_daily
        spark = raw.get("spark", [])
        if spark:
            # spark is oldest-first (legacy compute reverses closes which are newest-first)
            dates = nyse_trading_dates_backwards(as_of, len(spark))
            dates.reverse()  # oldest first to match spark order
            prices = []
            for i, close in enumerate(spark):
                if close and i < len(dates):
                    prices.append({
                        "ticker": ticker,
                        "date": dates[i],
                        "close": close,
                    })
            if prices:
                client.table("prices_daily").upsert(
                    prices, on_conflict="ticker,date"
                ).execute()

        print(f"  stock {ticker}: fundamentals + {len(spark)} spark closes")


def main():
    parser = argparse.ArgumentParser(description="Import legacy data into Supabase")
    parser.add_argument("--supabase-url", default="http://127.0.0.1:54321")
    parser.add_argument("--supabase-key", default=None,
                        help="Service role key (reads from SUPABASE_SERVICE_ROLE_KEY env if not set)")
    args = parser.parse_args()

    key = args.supabase_key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        print("Error: provide --supabase-key or set SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)

    client = get_client(args.supabase_url, key)
    assets = load_assets(client)
    print(f"Active assets: {sorted(assets)}")

    print("\nImporting snapshots...")
    import_snapshots(client, assets)

    print("\nImporting days...")
    import_days(client, assets)

    print("\nImporting stocks...")
    import_stocks(client, assets)

    print("\nDone!")


if __name__ == "__main__":
    main()
