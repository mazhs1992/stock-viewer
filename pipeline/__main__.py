"""Pipeline entry point.

Usage:
  python -m pipeline --kind manual --ticker MU
  python -m pipeline --kind cron
  python -m pipeline --kind manual --ticker MU --mock
"""
import argparse
import datetime as dt
import json
import sys
import traceback
import uuid

from supabase import create_client

from .config import SUPABASE_URL, SUPABASE_KEY
from .trading_date import get_trading_date


def create_run(client, kind: str, scope: str, trading_date: str, requested_by: str | None = None) -> str:
    """Create a runs row and return the run_id."""
    run_id = str(uuid.uuid4())
    client.table("runs").insert({
        "id": run_id,
        "kind": kind,
        "scope": scope,
        "status": "queued",
        "trading_date": trading_date,
        "requested_by": requested_by,
    }).execute()
    return run_id


def check_idempotency(client, trading_date: str, kind: str) -> bool:
    """For cron runs, check if predictions already exist for this trading_date."""
    if kind != "cron":
        return False
    resp = client.table("predictions").select("ticker", count="exact").eq(
        "date", trading_date
    ).eq("run_kind", "cron").limit(1).execute()
    return (resp.count or 0) > 0


def update_run(client, run_id: str, **fields):
    """Update a run row."""
    client.table("runs").update(fields).eq("id", run_id).execute()


def main():
    parser = argparse.ArgumentParser(description="Stock Viewer Pipeline")
    parser.add_argument("--kind", required=True, choices=["cron", "manual"])
    parser.add_argument("--ticker", default=None, help="Single ticker (manual run)")
    parser.add_argument("--run-id", default=None, help="Pre-assigned run ID")
    parser.add_argument("--mock", action="store_true", help="Use mock data (no API calls)")
    args = parser.parse_args()

    if not SUPABASE_KEY:
        print("Error: SUPABASE_SERVICE_ROLE_KEY not set")
        sys.exit(1)

    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    trading_date = get_trading_date()
    td_str = trading_date.isoformat()
    scope = args.ticker or "all"

    print(f"Pipeline: kind={args.kind} scope={scope} trading_date={td_str} mock={args.mock}")

    # Idempotency check for cron
    if check_idempotency(client, td_str, args.kind):
        print(f"Already done: cron predictions exist for {td_str}")
        if args.run_id:
            update_run(client, args.run_id, status="ok",
                       finished_at=dt.datetime.now(dt.timezone.utc).isoformat(),
                       log=json.dumps({"message": "already done"}))
        sys.exit(0)

    # Create or use existing run
    run_id = args.run_id or create_run(client, args.kind, scope, td_str)
    update_run(client, run_id, status="running",
               started_at=dt.datetime.now(dt.timezone.utc).isoformat())

    # Get active assets
    query = client.table("assets").select("*").eq("active", True)
    if args.ticker:
        query = query.eq("ticker", args.ticker)
    assets_resp = query.execute()
    assets = assets_resp.data
    if not assets:
        print("No active assets found")
        update_run(client, run_id, status="failed",
                   finished_at=dt.datetime.now(dt.timezone.utc).isoformat(),
                   errors=json.dumps({"message": "no active assets"}))
        sys.exit(1)

    print(f"Processing {len(assets)} assets: {[a['ticker'] for a in assets]}")

    run_log = {}
    run_errors = {}
    total_tokens_in = 0
    total_tokens_out = 0
    stale_tickers = []

    try:
        # Phase 1: Collect data
        if args.mock:
            from .collect.mock import collect_all_mock
            collected = collect_all_mock(assets, td_str)
        else:
            from .collect.runner import collect_all
            collected = collect_all(client, assets, td_str)

        run_log["collect"] = {
            "tickers": len(collected),
            "stale": [t for t in collected if collected[t].get("stale")],
        }
        stale_tickers = run_log["collect"]["stale"]

        # Phase 2: Collect market data
        if args.mock:
            from .collect.mock import collect_market_mock
            market = collect_market_mock(td_str)
        else:
            from .collect.market import collect_market
            market = collect_market(client, td_str)

        # Phase 3: Claude analysis
        if args.mock:
            from .analyze.mock import analyze_all_mock
            judgments, market_analysis, tokens = analyze_all_mock(collected, market, td_str)
        else:
            from .analyze.claude import analyze_all
            judgments, market_analysis, tokens = analyze_all(
                collected, market, td_str, args.kind
            )
        total_tokens_in += tokens.get("input", 0)
        total_tokens_out += tokens.get("output", 0)

        # Phase 4: Compute projections
        from .compute import compute_projections
        predictions = {}
        for ticker, data in collected.items():
            closes = data.get("closes", [])
            target = data.get("target")
            score = judgments.get(ticker, {}).get("score", 0)
            vol_override = next((a.get("vol_override") for a in assets if a["ticker"] == ticker), None)
            result = compute_projections(
                price=data["price"],
                closes=closes,
                target=target,
                score=score,
                vol_override=vol_override,
            )
            predictions[ticker] = {
                "price0": data["price"],
                "vol": result["vol"],
                "mu": result["mu"],
                "projections": result["projections"],
                "score": score,
            }

        # Phase 5: Store everything
        from .store.writer import store_results
        store_results(
            client=client,
            run_id=run_id,
            run_kind=args.kind,
            trading_date=td_str,
            collected=collected,
            market=market,
            judgments=judgments,
            market_analysis=market_analysis,
            predictions=predictions,
            assets=assets,
        )

        # Phase 6: Compute and store accuracy
        from .store.accuracy_writer import recompute_accuracy
        recompute_accuracy(client, td_str)

        status = "partial" if stale_tickers else "ok"

    except Exception as e:
        status = "failed"
        run_errors["exception"] = traceback.format_exc()
        print(f"Pipeline failed: {e}")

    # Compute cost
    from .config import ANTHROPIC_PRICING, ANTHROPIC_MODEL, BATCH_DISCOUNT
    pricing = ANTHROPIC_PRICING.get(ANTHROPIC_MODEL, {"input": 3.0, "output": 15.0})
    cost = (total_tokens_in * pricing["input"] + total_tokens_out * pricing["output"]) / 1_000_000
    if args.kind == "cron":
        cost *= BATCH_DISCOUNT

    update_run(client, run_id,
               status=status,
               finished_at=dt.datetime.now(dt.timezone.utc).isoformat(),
               tokens_in=total_tokens_in,
               tokens_out=total_tokens_out,
               cost_usd=round(cost, 4),
               log=json.dumps(run_log, default=str),
               errors=json.dumps(run_errors, default=str) if run_errors else None)

    print(f"Pipeline finished: status={status} tokens_in={total_tokens_in} tokens_out={total_tokens_out} cost=${cost:.4f}")


if __name__ == "__main__":
    main()
