"""Store pipeline results into Supabase."""
import datetime as dt


def store_results(
    client,
    run_id: str,
    run_kind: str,
    trading_date: str,
    collected: dict,
    market: dict,
    judgments: dict,
    market_analysis: dict,
    predictions: dict,
    assets: list[dict],
):
    """Persist all pipeline outputs to the database."""

    # 1. Prices daily (from closes)
    _store_prices(client, collected, trading_date)

    # 2. Fundamentals daily
    _store_fundamentals(client, collected, trading_date)

    # 3. News items
    _store_news(client, collected, trading_date)

    # 4. Judgments
    _store_judgments(client, judgments, trading_date, run_id)

    # 5. Market daily
    _store_market(client, market, market_analysis, trading_date)

    # 6. Predictions (insert-only)
    _store_predictions(client, predictions, trading_date, run_kind, run_id)

    # 7. Update source last_ok_at
    _update_sources(client, collected)

    print(f"  Stored results for {len(collected)} tickers")


def _store_prices(client, collected: dict, trading_date: str):
    """Upsert prices from collected closes."""
    seen: dict[tuple[str, str], dict] = {}
    for ticker, data in collected.items():
        # Historical closes first (lower priority)
        for c in data.get("closes_dated", []):
            key = (ticker, c["date"])
            seen[key] = {
                "ticker": ticker,
                "date": c["date"],
                "close": c["close"],
                "source_id": data.get("source_ids", {}).get("closes"),
            }
        # Current price overwrites if same date
        if data.get("price"):
            key = (ticker, trading_date)
            seen[key] = {
                "ticker": ticker,
                "date": trading_date,
                "close": data["price"],
                "source_id": data.get("source_ids", {}).get("quote"),
            }
    rows = list(seen.values())
    if rows:
        for i in range(0, len(rows), 100):
            client.table("prices_daily").upsert(
                rows[i:i+100], on_conflict="ticker,date"
            ).execute()
        print(f"    Stored {len(rows)} price rows")


def _store_fundamentals(client, collected: dict, trading_date: str):
    """Upsert fundamentals for each ticker."""
    rows = []
    for ticker, data in collected.items():
        if not data.get("price"):
            continue
        row = {
            "ticker": ticker,
            "date": trading_date,
            "price": data.get("price"),
            "chg_pct": data.get("change_pct"),
            "low52": data.get("low52"),
            "high52": data.get("high52"),
            "beta": data.get("beta"),
            "pe": data.get("pe"),
            "fpe": data.get("fpe"),
            "rating": _parse_rating(data.get("rating")),
            "target": data.get("target"),
            "analysts": data.get("analysts"),
            "next_earnings": data.get("next_earnings"),
            "source_ids": data.get("source_ids", {}),
        }
        rows.append(row)
    if rows:
        client.table("fundamentals_daily").upsert(
            rows, on_conflict="ticker,date"
        ).execute()
        print(f"    Stored {len(rows)} fundamentals rows")


def _store_news(client, collected: dict, trading_date: str):
    """Insert news items, skip duplicates on url."""
    count = 0
    for ticker, data in collected.items():
        for n in data.get("news", []):
            url = n.get("url", "")
            if not url:
                continue
            try:
                client.table("news_items").upsert({
                    "ticker": ticker,
                    "date": trading_date,
                    "title": n.get("title", "")[:500],
                    "source_name": n.get("source_name", ""),
                    "url": url,
                    "published_at": n.get("published_at"),
                    "snippet": (n.get("snippet") or "")[:500],
                }, on_conflict="url").execute()
                count += 1
            except Exception:
                pass
    print(f"    Stored {count} news items")


def _store_judgments(client, judgments: dict, trading_date: str, run_id: str):
    """Upsert judgments."""
    rows = []
    for ticker, j in judgments.items():
        rows.append({
            "ticker": ticker,
            "date": trading_date,
            "run_id": run_id,
            "score": j.get("score", 0),
            "is_event": j.get("is_event", False),
            "why": j.get("why", ""),
            "summary": j.get("summary", ""),
            "sentiment": j.get("sentiment", 0),
            "importance": j.get("importance", 0),
            "tags": j.get("tags", []),
        })
    if rows:
        client.table("judgments").upsert(
            rows, on_conflict="ticker,date,run_id"
        ).execute()
        print(f"    Stored {len(rows)} judgments")


def _store_market(client, market: dict, market_analysis: dict, trading_date: str):
    """Upsert market daily."""
    row = {
        "date": trading_date,
        "fear_greed": market.get("fear_greed"),
        "fear_greed_label": market.get("fear_greed_label"),
        "fear_greed_prev_week": market.get("fear_greed_prev_week"),
        "vix": market.get("vix"),
        "us10y": market.get("us10y"),
        "mood": market_analysis.get("mood"),
        "summary": market_analysis.get("summary"),
        "market_note": market_analysis.get("market_note"),
    }
    client.table("market_daily").upsert(row, on_conflict="date").execute()
    print(f"    Stored market daily")


def _store_predictions(client, predictions: dict, trading_date: str, run_kind: str, run_id: str):
    """Insert predictions (insert-only, ignore duplicates)."""
    rows = []
    for ticker, pred in predictions.items():
        for horizon, proj in pred["projections"].items():
            rows.append({
                "ticker": ticker,
                "date": trading_date,
                "horizon": horizon,
                "run_kind": run_kind,
                "price0": pred["price0"],
                "bear": proj["bear"],
                "base": proj["base"],
                "bull": proj["bull"],
                "vol": pred["vol"],
                "mu": pred["mu"],
                "score": pred.get("score", 0),
                "model_version": "v1",
                "run_id": run_id,
            })
    if rows:
        client.table("predictions").upsert(
            rows, on_conflict="ticker,date,horizon,run_kind",
            ignore_duplicates=True,
        ).execute()
        print(f"    Stored {len(rows)} predictions")


def _parse_rating(rating) -> float | None:
    """Convert string ratings to numeric."""
    if rating is None:
        return None
    if isinstance(rating, (int, float)):
        return float(rating)
    rating_map = {
        "Strong Buy": 5.0, "Buy": 4.0, "Overweight": 4.0,
        "Hold": 3.0, "Neutral": 3.0, "Equal-Weight": 3.0,
        "Underweight": 2.0, "Sell": 2.0, "Strong Sell": 1.0,
    }
    return rating_map.get(str(rating))


def _update_sources(client, collected: dict):
    """Update source last_ok_at for sources that provided data."""
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    source_ids = set()
    for data in collected.values():
        for sid in data.get("source_ids", {}).values():
            if sid:
                source_ids.add(sid)
    for sid in source_ids:
        try:
            client.table("sources").update({"last_ok_at": now}).eq("id", sid).execute()
        except Exception:
            pass
