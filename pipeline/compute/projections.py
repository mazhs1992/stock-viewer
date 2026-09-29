"""Projection engine — ported from legacy/compute.py.

Math is identical: lognormal model with realised vol, analyst-implied drift,
and news tilt. Z = 1.2816 for 10th/90th percentile bands.
"""
import math

Z90 = 1.2816

# Horizon T in years (trading-year fractions)
HORIZONS = {
    "d1": 1 / 252,
    "w1": 5 / 252,
    "m1": 1 / 12,
    "m3": 0.25,
    "m6": 0.5,
    "y1": 1.0,
}

# Calendar days per horizon (for accuracy matching)
CAL_DAYS = {"d1": 1, "w1": 7, "m1": 30, "m3": 91, "m6": 182, "y1": 365}

# Grace days: how late an outcome can arrive
GRACE = {"d1": 4, "w1": 4, "m1": 5, "m3": 7, "m6": 10, "y1": 10}

# News tilt per score point
TILT = {"d1": 0.005, "w1": 0.005, "m1": 0.01, "m3": 0.0, "m6": 0.0, "y1": 0.0}


def realised_vol(closes: list[float | None]) -> float | None:
    """Annualised vol from daily log-returns. Closes are newest-first."""
    c = [x for x in closes if x]
    if len(c) < 15:
        return None
    rets = [math.log(c[i] / c[i + 1]) for i in range(len(c) - 1)]
    m = sum(rets) / len(rets)
    var = sum((r - m) ** 2 for r in rets) / (len(rets) - 1)
    return math.sqrt(var) * math.sqrt(252)


def drift(price: float, target: float | None) -> float:
    """Annualised drift from analyst target. No target → 5%."""
    if not target or not price:
        return 0.05
    implied = math.log(target / price)
    return max(-0.15, min(0.25, 0.07 + 0.30 * (implied - 0.07)))


def _rnd(x: float | None) -> float | None:
    """Round like the legacy code: 2 decimals if >= 10, else 3."""
    if x is None:
        return None
    return round(x, 2) if abs(x) >= 10 else round(x, 3)


def compute_projections(
    price: float,
    closes: list[float | None],
    target: float | None,
    score: int,
    vol_override: float | None = None,
    limited: bool = False,
) -> dict:
    """Compute projections for all horizons.

    Returns dict with keys:
      vol, mu, projections: {horizon: {bear, base, bull}}
    """
    sig = realised_vol(closes) or vol_override or 0.30
    sig = max(sig, 0.10 if vol_override else 0.18)
    mu = drift(price, target)

    projections = {}
    for h, T in HORIZONS.items():
        m = mu * T + score * TILT[h]
        s = sig * math.sqrt(T)
        projections[h] = {
            "bear": _rnd(price * math.exp(m - Z90 * s)),
            "base": _rnd(price * math.exp(m)),
            "bull": _rnd(price * math.exp(m + Z90 * s)),
        }

    return {
        "vol": round(sig, 4),
        "mu": round(mu, 4),
        "projections": projections,
    }
