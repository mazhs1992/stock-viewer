"""Twelve Data API collector: daily closes."""
import time
import httpx
from ..config import TWELVEDATA_API_KEY, TWELVEDATA_CALLS_PER_MIN

BASE_URL = "https://api.twelvedata.com"
_call_times: list[float] = []


def _rate_limit():
    """Enforce 8 calls/min rate limit."""
    now = time.time()
    _call_times[:] = [t for t in _call_times if now - t < 60]
    if len(_call_times) >= TWELVEDATA_CALLS_PER_MIN:
        wait = 60 - (now - _call_times[0])
        if wait > 0:
            print(f"  TwelveData rate limit: waiting {wait:.1f}s")
            time.sleep(wait)
    _call_times.append(time.time())


def _get(endpoint: str, params: dict | None = None, retries: int = 2) -> dict | None:
    """GET with rate limiting and retries."""
    if not TWELVEDATA_API_KEY:
        return None
    _rate_limit()
    p = {"apikey": TWELVEDATA_API_KEY, **(params or {})}
    for attempt in range(retries + 1):
        try:
            resp = httpx.get(f"{BASE_URL}/{endpoint}", params=p, timeout=15)
            if resp.status_code == 429:
                wait = 2 ** attempt * 10
                print(f"  TwelveData 429, waiting {wait}s")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            data = resp.json()
            if data.get("status") == "error":
                print(f"  TwelveData error: {data.get('message', '')}")
                return None
            return data
        except Exception as e:
            if attempt < retries:
                time.sleep(2 ** attempt)
                continue
            print(f"  TwelveData error ({endpoint}): {e}")
            return None


def get_daily_closes(ticker: str, outputsize: int = 60) -> list[dict]:
    """Get daily closes. Returns list of {date, close} newest first."""
    data = _get("time_series", {
        "symbol": ticker,
        "interval": "1day",
        "outputsize": outputsize,
        "format": "JSON",
    })
    if not data or "values" not in data:
        return []
    closes = []
    for v in data["values"]:
        try:
            closes.append({
                "date": v["datetime"],
                "close": float(v["close"]),
            })
        except (KeyError, ValueError):
            continue
    return closes  # newest first (TwelveData default)
