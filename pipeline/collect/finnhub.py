"""Finnhub API collector: quotes, news, analyst recommendations, earnings."""
import datetime as dt
import time
import httpx
from ..config import FINNHUB_API_KEY, FINNHUB_CALLS_PER_MIN

BASE_URL = "https://finnhub.io/api/v1"
_call_times: list[float] = []


def _rate_limit():
    """Enforce 60 calls/min rate limit."""
    now = time.time()
    _call_times[:] = [t for t in _call_times if now - t < 60]
    if len(_call_times) >= FINNHUB_CALLS_PER_MIN:
        wait = 60 - (now - _call_times[0])
        if wait > 0:
            print(f"  Finnhub rate limit: waiting {wait:.1f}s")
            time.sleep(wait)
    _call_times.append(time.time())


def _get(endpoint: str, params: dict | None = None, retries: int = 2) -> dict | list | None:
    """GET with rate limiting and retries."""
    if not FINNHUB_API_KEY:
        return None
    _rate_limit()
    p = {"token": FINNHUB_API_KEY, **(params or {})}
    for attempt in range(retries + 1):
        try:
            resp = httpx.get(f"{BASE_URL}/{endpoint}", params=p, timeout=15)
            if resp.status_code == 429:
                wait = 2 ** attempt * 5
                print(f"  Finnhub 429, waiting {wait}s")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            if attempt < retries:
                time.sleep(2 ** attempt)
                continue
            print(f"  Finnhub error ({endpoint}): {e}")
            return None


def get_quote(ticker: str) -> dict | None:
    """Get current quote. Returns {price, change, change_pct, high, low, open, prev_close}."""
    data = _get("quote", {"symbol": ticker})
    if not data or not data.get("c"):
        return None
    return {
        "price": data["c"],
        "change": data["d"],
        "change_pct": data["dp"],
        "high": data["h"],
        "low": data["l"],
        "open": data["o"],
        "prev_close": data["pc"],
    }


def get_news(ticker: str, days_back: int = 2) -> list[dict]:
    """Get company news from the last N days. Returns up to 8 items."""
    to = dt.date.today()
    frm = to - dt.timedelta(days=days_back)
    data = _get("company-news", {
        "symbol": ticker,
        "from": frm.isoformat(),
        "to": to.isoformat(),
    })
    if not data:
        # Fallback: get latest 3
        data = _get("company-news", {
            "symbol": ticker,
            "from": (to - dt.timedelta(days=14)).isoformat(),
            "to": to.isoformat(),
        })
    items = []
    seen_urls = set()
    for n in (data or []):
        url = n.get("url", "")
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        items.append({
            "title": n.get("headline", ""),
            "url": url,
            "source_name": n.get("source", ""),
            "published_at": dt.datetime.fromtimestamp(
                n.get("datetime", 0), tz=dt.timezone.utc
            ).isoformat() if n.get("datetime") else None,
            "snippet": (n.get("summary", "") or "")[:500],
        })
        if len(items) >= 8:
            break
    # If none from last 2 days, take latest 3
    if not items and data:
        for n in data[:3]:
            url = n.get("url", "")
            if not url:
                continue
            items.append({
                "title": n.get("headline", ""),
                "url": url,
                "source_name": n.get("source", ""),
                "published_at": dt.datetime.fromtimestamp(
                    n.get("datetime", 0), tz=dt.timezone.utc
                ).isoformat() if n.get("datetime") else None,
                "snippet": (n.get("summary", "") or "")[:500],
            })
    return items


def get_recommendation(ticker: str) -> dict | None:
    """Get analyst recommendations. Returns {rating, target, analysts, buy, hold, sell}."""
    # Recommendation trends
    data = _get("stock/recommendation", {"symbol": ticker})
    if not data:
        return None
    latest = data[0] if data else {}

    # Price target
    target_data = _get("stock/price-target", {"symbol": ticker})

    buy = latest.get("buy", 0) + latest.get("strongBuy", 0)
    hold = latest.get("hold", 0)
    sell = latest.get("sell", 0) + latest.get("strongSell", 0)
    total = buy + hold + sell

    result = {
        "analysts": total,
        "buy": buy,
        "hold": hold,
        "sell": sell,
    }
    if target_data:
        result["target"] = target_data.get("targetMedian") or target_data.get("targetMean")

    # Compute simple rating score
    if total > 0:
        score = (buy * 5 + hold * 3 + sell * 1) / total
        result["rating"] = round(score, 2)

    return result


def get_earnings_date(ticker: str) -> str | None:
    """Get next earnings date."""
    today = dt.date.today()
    data = _get("calendar/earnings", {
        "symbol": ticker,
        "from": today.isoformat(),
        "to": (today + dt.timedelta(days=90)).isoformat(),
    })
    if data and data.get("earningsCalendar"):
        dates = sorted(data["earningsCalendar"], key=lambda x: x.get("date", ""))
        if dates:
            return dates[0].get("date")
    return None
