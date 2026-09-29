"""Market data collector: Fear & Greed, VIX, US 10y."""
import httpx


def collect_market(client, trading_date: str) -> dict:
    """Collect market-level data."""
    data = {
        "date": trading_date,
        "fear_greed": None,
        "fear_greed_label": None,
        "fear_greed_prev_week": None,
        "vix": None,
        "us10y": None,
    }

    # CNN Fear & Greed
    fg = _get_fear_greed()
    if fg:
        data["fear_greed"] = fg.get("score")
        data["fear_greed_label"] = fg.get("label")
        data["fear_greed_prev_week"] = fg.get("prev_week")
        print(f"  Fear & Greed: {fg.get('score')} ({fg.get('label')})")

    # VIX and 10y from Finnhub (if available)
    from . import finnhub
    vix_quote = finnhub.get_quote("^VIX")
    if vix_quote:
        data["vix"] = vix_quote["price"]
        print(f"  VIX: {vix_quote['price']}")

    # US 10y - try Finnhub index
    tnx_quote = finnhub.get_quote("^TNX")
    if tnx_quote:
        data["us10y"] = tnx_quote["price"]
        print(f"  US 10y: {tnx_quote['price']}")

    return data


def _get_fear_greed() -> dict | None:
    """Fetch CNN Fear & Greed index."""
    try:
        resp = httpx.get(
            "https://production.dataviz.cnn.io/index/fearandgreed/graphdata",
            headers={"User-Agent": "StockViewer/1.0"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        fg = data.get("fear_and_greed", {})
        prev = data.get("fear_and_greed_historical", {}).get("one_week_ago", {})

        score = fg.get("score")
        rating = fg.get("rating", "")

        # Translate rating to Greek
        label_map = {
            "Extreme Fear": "Ακραίος φόβος",
            "Fear": "Φόβος",
            "Neutral": "Ουδέτερο",
            "Greed": "Απληστία",
            "Extreme Greed": "Ακραία απληστία",
        }

        return {
            "score": round(score, 1) if score else None,
            "label": label_map.get(rating, rating),
            "prev_week": round(prev.get("score", 0), 1) if prev.get("score") else None,
        }
    except Exception as e:
        print(f"  Fear & Greed failed: {e}")
        return None
