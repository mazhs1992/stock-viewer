"""Collection orchestrator: runs collectors for each asset with source priority."""
import datetime as dt
from . import finnhub, twelvedata


def collect_all(client, assets: list[dict], trading_date: str) -> dict:
    """Collect data for all assets. Returns {ticker: collected_data}."""
    # Load sources for provenance
    sources_resp = client.table("sources").select("*").eq("enabled", True).order("priority").execute()
    sources = sources_resp.data

    # Get existing closes to determine if we need full or incremental
    results = {}

    for asset in assets:
        ticker = asset["ticker"]
        print(f"\n  Collecting {ticker}...")
        data: dict = {"ticker": ticker, "stale": False, "source_ids": {}}

        # Quote (Finnhub primary)
        quote = finnhub.get_quote(ticker)
        if quote:
            data["price"] = quote["price"]
            data["change_pct"] = quote["change_pct"]
            data["source_ids"]["quote"] = _source_id(sources, "Finnhub")
            print(f"    Quote: ${quote['price']} ({quote['change_pct']:+.2f}%)")
        else:
            data["stale"] = True
            print(f"    Quote: FAILED")

        # Daily closes (Twelve Data primary)
        existing_count = _count_closes(client, ticker)
        outputsize = 60 if existing_count < 30 else 10
        closes_data = twelvedata.get_daily_closes(ticker, outputsize=outputsize)
        if closes_data:
            data["closes"] = [c["close"] for c in closes_data]  # newest first
            data["closes_dated"] = closes_data
            data["source_ids"]["closes"] = _source_id(sources, "Twelve Data")
            print(f"    Closes: {len(closes_data)} days")
        else:
            # Fallback: use existing closes from DB
            db_closes = _get_db_closes(client, ticker, 60)
            data["closes"] = db_closes
            data["closes_dated"] = []
            if db_closes:
                data["source_ids"]["closes"] = _source_id(sources, "Twelve Data")
                print(f"    Closes: {len(db_closes)} from DB (fallback)")
            else:
                print(f"    Closes: NONE")

        # Sanity check: latest close vs quote (within ~3%)
        if data.get("price") and data.get("closes") and data["closes"]:
            latest_close = data["closes"][0]
            diff = abs(data["price"] / latest_close - 1)
            if diff > 0.03:
                print(f"    WARNING: price/close mismatch {diff:.1%}")
                data["stale"] = True

        # Analyst recommendations (Finnhub)
        rec = finnhub.get_recommendation(ticker)
        if rec:
            data["target"] = rec.get("target")
            data["analysts"] = rec.get("analysts")
            data["rating"] = rec.get("rating")
            data["source_ids"]["analysts"] = _source_id(sources, "Finnhub")
            print(f"    Analysts: {rec.get('analysts')} target=${rec.get('target')}")

        # Earnings date (Finnhub)
        earnings = finnhub.get_earnings_date(ticker)
        if earnings:
            data["next_earnings"] = earnings
            data["source_ids"]["earnings"] = _source_id(sources, "Finnhub")
            print(f"    Next earnings: {earnings}")

        # News (Finnhub)
        news = finnhub.get_news(ticker)
        data["news"] = news
        data["source_ids"]["news"] = _source_id(sources, "Finnhub")
        print(f"    News: {len(news)} items")

        # Fundamentals from Finnhub (basic metrics)
        basic = finnhub._get("stock/metric", {"symbol": ticker, "metric": "all"})
        if basic and basic.get("metric"):
            m = basic["metric"]
            data["pe"] = m.get("peExclExtraTTM")
            data["fpe"] = m.get("peTTM")
            data["beta"] = m.get("beta")
            data["low52"] = m.get("52WeekLow")
            data["high52"] = m.get("52WeekHigh")

        results[ticker] = data

    return results


def _source_id(sources: list[dict], name: str) -> int | None:
    """Find source ID by name."""
    for s in sources:
        if s["name"] == name:
            return s["id"]
    return None


def _count_closes(client, ticker: str) -> int:
    """Count existing closes in DB for a ticker."""
    resp = client.table("prices_daily").select("ticker", count="exact").eq("ticker", ticker).execute()
    return resp.count or 0


def _get_db_closes(client, ticker: str, limit: int) -> list[float]:
    """Get closes from DB, newest first."""
    resp = client.table("prices_daily").select("close").eq(
        "ticker", ticker
    ).order("date", desc=True).limit(limit).execute()
    return [r["close"] for r in (resp.data or [])]
