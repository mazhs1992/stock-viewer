"""Mock collectors using legacy data fixtures. No API calls, no cost."""
import json
import os

LEGACY_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "legacy", "data")


def collect_all_mock(assets: list[dict], trading_date: str) -> dict:
    """Load collected data from legacy stock files."""
    results = {}
    for asset in assets:
        ticker = asset["ticker"]
        stock_file = os.path.join(LEGACY_DIR, "stocks", f"{ticker}.json")
        if not os.path.exists(stock_file):
            print(f"  Mock: no data for {ticker}")
            results[ticker] = {
                "ticker": ticker, "stale": True, "price": 0, "closes": [],
                "news": [], "source_ids": {},
            }
            continue

        raw = json.load(open(stock_file))
        # spark is oldest-first in the legacy format
        spark = raw.get("spark", [])

        results[ticker] = {
            "ticker": ticker,
            "stale": False,
            "price": raw.get("price", 0),
            "change_pct": raw.get("chgPct"),
            "closes": list(reversed(spark)),  # newest first for compute
            "closes_dated": [],  # no dates in mock
            "target": raw.get("target"),
            "analysts": raw.get("analysts"),
            "rating": raw.get("rating"),
            "pe": raw.get("pe"),
            "fpe": raw.get("fpe"),
            "beta": raw.get("beta"),
            "low52": raw.get("low52"),
            "high52": raw.get("high52"),
            "next_earnings": raw.get("nextEarnings"),
            "news": _load_news(ticker, trading_date),
            "source_ids": {},
        }
        print(f"  Mock {ticker}: ${raw.get('price')} ({len(spark)} closes)")

    return results


def collect_market_mock(trading_date: str) -> dict:
    """Return mock market data."""
    return {
        "date": trading_date,
        "fear_greed": 45,
        "fear_greed_label": "Φόβος",
        "fear_greed_prev_week": 50,
        "vix": 18.5,
        "us10y": 4.25,
    }


def _load_news(ticker: str, trading_date: str) -> list[dict]:
    """Load news from legacy days file."""
    # Try to find a days file
    days_dir = os.path.join(LEGACY_DIR, "days")
    if not os.path.isdir(days_dir):
        return []
    # Use the most recent days file
    files = sorted(os.listdir(days_dir), reverse=True)
    for fname in files:
        if not fname.endswith(".json"):
            continue
        raw = json.load(open(os.path.join(days_dir, fname)))
        item = raw.get("items", {}).get(ticker, {})
        if item:
            return [
                {
                    "title": h.get("t", ""),
                    "url": h.get("url", ""),
                    "source_name": h.get("src", ""),
                    "snippet": "",
                }
                for h in item.get("headlines", [])
                if h.get("url")
            ]
    return []
