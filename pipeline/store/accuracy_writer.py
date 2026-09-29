"""Recompute and store accuracy after a pipeline run."""
from ..compute.accuracy import evaluate, compute_accuracy, CAL_DAYS


def recompute_accuracy(client, trading_date: str):
    """Load all cron predictions, evaluate accuracy, store results."""
    # Load all cron predictions with outcomes
    pred_resp = client.table("predictions").select(
        "ticker, date, horizon, price0, bear, base, bull"
    ).eq("run_kind", "cron").order("date").execute()
    predictions = pred_resp.data or []

    if not predictions:
        print("    No cron predictions for accuracy")
        return

    # Build snapshot-like structure for the evaluate function
    snapshots = {}
    for p in predictions:
        d = p["date"]
        if d not in snapshots:
            snapshots[d] = {"assets": {}}
        t = p["ticker"]
        if t not in snapshots[d]["assets"]:
            snapshots[d]["assets"][t] = {"p": float(p["price0"])}
        h = p["horizon"]
        snapshots[d]["assets"][t][h] = {
            "bear": float(p["bear"]),
            "base": float(p["base"]),
            "bull": float(p["bull"]),
        }

    # We also need the outcome prices — load from prices_daily
    all_dates = sorted(snapshots.keys())
    for d in all_dates:
        for t in list(snapshots[d]["assets"].keys()):
            # Make sure we have the price for this date
            if "p" not in snapshots[d]["assets"][t]:
                price_resp = client.table("prices_daily").select("close").eq(
                    "ticker", t).eq("date", d).limit(1).execute()
                if price_resp.data:
                    snapshots[d]["assets"][t]["p"] = float(price_resp.data[0]["close"])

    # Evaluate
    rows = evaluate(snapshots)
    accuracy_rows = compute_accuracy(rows, trading_date, snapshots)

    if accuracy_rows:
        # Upsert accuracy
        for i in range(0, len(accuracy_rows), 50):
            batch = accuracy_rows[i:i+50]
            # Convert date objects to strings
            for r in batch:
                if r.get("last") and hasattr(r["last"], "isoformat"):
                    r["last"] = r["last"].isoformat()
                if r.get("first_due") and hasattr(r["first_due"], "isoformat"):
                    r["first_due"] = r["first_due"].isoformat()
            client.table("accuracy").upsert(
                batch, on_conflict="scope,horizon,win"
            ).execute()
        print(f"    Stored {len(accuracy_rows)} accuracy rows")
    else:
        print("    No matured predictions for accuracy yet")
