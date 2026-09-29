"""Accuracy engine — ported from legacy/compute.py.

Evaluates past predictions against outcomes. Computes hit rate, MAE,
direction accuracy, above/below counts across time windows.
"""
import datetime as dt
from .projections import CAL_DAYS, GRACE


def _d(s: str) -> dt.date:
    return dt.date.fromisoformat(s)


# Time windows for accuracy: name → days lookback (None = all-time)
WINDOWS = {"w1": 7, "m1": 30, "m3": 91, "m6": 182, "all": None}


def evaluate(snapshots: dict[str, dict]) -> list[dict]:
    """Find all matured (prediction, outcome) pairs.

    snapshots: {date_str: {"assets": {ticker: {"p": float, "d1": {bear,base,bull}, ...}}}}
    Returns list of dicts: h, t, from, to, bear, base, bull, p0, actual
    """
    dates = sorted(snapshots)
    out = []
    for i, s_date in enumerate(dates):
        later = dates[i + 1:]
        for h, days in CAL_DAYS.items():
            if h == "d1":
                cand = later[:1]
            else:
                cand = [x for x in later if _d(x) >= _d(s_date) + dt.timedelta(days=days)][:1]
            if not cand:
                continue
            o_date = cand[0]
            if (_d(o_date) - _d(s_date)).days > days + GRACE[h]:
                continue
            for t, a in snapshots[s_date]["assets"].items():
                pr = a.get(h)
                b = snapshots[o_date]["assets"].get(t)
                if not isinstance(pr, dict) or not b or not b.get("p") or not a.get("p"):
                    continue
                out.append({
                    "h": h, "t": t, "from": s_date, "to": o_date,
                    "p0": a["p"], "bear": pr["bear"], "base": pr["base"],
                    "bull": pr["bull"], "actual": b["p"],
                })
    return out


def summarise(rows: list[dict]) -> dict:
    """Summarise accuracy for a set of prediction-outcome pairs."""
    if not rows:
        return {"n": 0}
    inside = [r["bear"] <= r["actual"] <= r["bull"] for r in rows]
    err = [abs(r["actual"] / r["base"] - 1) for r in rows]
    dirs = [
        (r["actual"] - r["p0"]) * (r["base"] - r["p0"]) > 0
        for r in rows
        if r["actual"] != r["p0"] and r["base"] != r["p0"]
    ]
    above = sum(r["actual"] > r["bull"] for r in rows)
    below = sum(r["actual"] < r["bear"] for r in rows)
    return {
        "n": len(rows),
        "hit": round(sum(inside) / len(rows), 4),
        "mae": round(sum(err) / len(err), 4),
        "dir": round(sum(dirs) / len(dirs), 4) if dirs else None,
        "above": above,
        "below": below,
        "last": max(r["to"] for r in rows),
    }


def first_due(snapshots: dict[str, dict], today: str) -> dict[str, str]:
    """Earliest date each horizon can first be evaluated."""
    if not snapshots:
        start = _d(today)
    else:
        start = _d(min(snapshots))
    res = {}
    for h, days in CAL_DAYS.items():
        x = start + dt.timedelta(days=days)
        while x.weekday() >= 5:
            x += dt.timedelta(days=1)
        res[h] = x.isoformat()
    return res


def compute_accuracy(
    rows: list[dict],
    today: str,
    snapshots: dict[str, dict],
) -> list[dict]:
    """Compute accuracy rows for all (scope, horizon, window) combos.

    Returns list of dicts ready for upsert into the accuracy table:
      scope, horizon, win, n, hit, mae, dir, above, below, last, first_due
    """
    due = first_due(snapshots, today)
    today_date = _d(today)
    results = []

    # Scopes: each ticker + "ALL"
    tickers = set(r["t"] for r in rows)
    scopes = list(tickers) + ["ALL"]

    for scope in scopes:
        scope_rows = rows if scope == "ALL" else [r for r in rows if r["t"] == scope]
        for h in CAL_DAYS:
            h_rows = [r for r in scope_rows if r["h"] == h]
            for win_name, win_days in WINDOWS.items():
                if win_days is not None:
                    filtered = [r for r in h_rows if _d(r["to"]) >= today_date - dt.timedelta(days=win_days)]
                else:
                    filtered = h_rows
                stats = summarise(filtered)
                results.append({
                    "scope": scope,
                    "horizon": h,
                    "win": win_name,
                    "n": stats["n"],
                    "hit": stats.get("hit"),
                    "mae": stats.get("mae"),
                    "dir": stats.get("dir"),
                    "above": stats.get("above"),
                    "below": stats.get("below"),
                    "last": stats.get("last"),
                    "first_due": due.get(h),
                })

    return results
