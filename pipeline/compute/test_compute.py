"""Unit tests for the compute engine.

Verifies that the ported code produces identical output to legacy/compute.py.
"""
import math
import sys
import os

# Add legacy to path for comparison
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "legacy"))

import compute as legacy  # noqa: E402
from pipeline.compute.projections import (  # noqa: E402
    realised_vol,
    drift,
    compute_projections,
    HORIZONS,
    TILT,
    Z90,
    _rnd,
)
from pipeline.compute.accuracy import evaluate, summarise, first_due  # noqa: E402


# --- Synthetic test data ---
# 50 closes, newest first (fabricated but realistic for a ~$100 stock)
CLOSES = [
    102.5, 101.8, 103.2, 100.9, 101.5, 102.0, 103.5, 101.0, 100.5, 99.8,
    100.2, 101.1, 99.5, 98.7, 100.0, 101.3, 102.1, 100.8, 99.9, 100.4,
    101.7, 100.3, 99.1, 98.5, 99.8, 100.6, 101.2, 100.0, 99.3, 98.8,
    99.5, 100.1, 101.0, 100.5, 99.7, 98.9, 99.2, 100.3, 101.1, 100.7,
    99.8, 99.0, 98.5, 99.3, 100.0, 100.8, 101.5, 100.2, 99.6, 99.0,
]
PRICE = CLOSES[0]
TARGET = 115.0
SCORE = 1


def test_realised_vol():
    """realised_vol must match legacy."""
    new_vol = realised_vol(CLOSES)
    legacy_vol = legacy.realised_vol(CLOSES)
    assert new_vol is not None
    assert legacy_vol is not None
    assert abs(new_vol - legacy_vol) < 1e-10, f"{new_vol} != {legacy_vol}"


def test_realised_vol_short():
    """Less than 15 closes → None."""
    assert realised_vol(CLOSES[:10]) is None
    assert legacy.realised_vol(CLOSES[:10]) is None


def test_drift():
    """drift must match legacy."""
    assert abs(drift(PRICE, TARGET) - legacy.drift(PRICE, TARGET)) < 1e-10
    assert abs(drift(PRICE, None) - legacy.drift(PRICE, None)) < 1e-10
    assert abs(drift(0, TARGET) - legacy.drift(0, TARGET)) < 1e-10


def test_projections_match_legacy():
    """Full projection for all legacy horizons must match to 1e-6."""
    result = compute_projections(PRICE, CLOSES, TARGET, SCORE)
    sig = result["vol"]
    mu = result["mu"]

    # Legacy compute
    legacy_sig = legacy.realised_vol(CLOSES) or 0.30
    legacy_sig = max(legacy_sig, 0.18)
    legacy_mu = legacy.drift(PRICE, TARGET)

    assert abs(sig - round(legacy_sig, 4)) < 1e-6
    assert abs(mu - round(legacy_mu, 4)) < 1e-6

    # Compare each legacy horizon
    for h in legacy.HORIZONS:
        T = legacy.HORIZONS[h]
        m = legacy_mu * T + SCORE * legacy.TILT[h]
        s = legacy_sig * math.sqrt(T)
        expected_bear = legacy.rnd(PRICE * math.exp(m - legacy.Z90 * s))
        expected_base = legacy.rnd(PRICE * math.exp(m))
        expected_bull = legacy.rnd(PRICE * math.exp(m + legacy.Z90 * s))

        proj = result["projections"][h]
        assert abs(proj["bear"] - expected_bear) < 1e-6, f"{h} bear: {proj['bear']} != {expected_bear}"
        assert abs(proj["base"] - expected_base) < 1e-6, f"{h} base: {proj['base']} != {expected_base}"
        assert abs(proj["bull"] - expected_bull) < 1e-6, f"{h} bull: {proj['bull']} != {expected_bull}"


def test_y1_horizon_exists():
    """y1 horizon should be computed (not in legacy)."""
    result = compute_projections(PRICE, CLOSES, TARGET, SCORE)
    assert "y1" in result["projections"]
    proj = result["projections"]["y1"]
    assert proj["bear"] < proj["base"] < proj["bull"]


def test_vol_override():
    """When closes are too short, vol_override kicks in."""
    result = compute_projections(PRICE, CLOSES[:5], TARGET, SCORE, vol_override=0.25)
    assert result["vol"] == 0.25  # max(0.25, 0.10) = 0.25


def test_vol_floor():
    """Vol floor is 18% without override, 10% with override."""
    # Create closes with very low vol
    flat_closes = [100.0 + 0.01 * i for i in range(50)]
    result = compute_projections(100.0, flat_closes, None, 0)
    assert result["vol"] >= 0.18

    result2 = compute_projections(100.0, flat_closes, None, 0, vol_override=0.05)
    assert result2["vol"] >= 0.10


def test_evaluate_matches_legacy():
    """evaluate() must produce identical pairs to legacy."""
    snapshots = {
        "2024-01-02": {
            "assets": {
                "TEST": {"p": 100.0, "score": 0,
                         "d1": {"bear": 98, "base": 100, "bull": 102},
                         "w1": {"bear": 95, "base": 100, "bull": 105}},
            }
        },
        "2024-01-03": {
            "assets": {
                "TEST": {"p": 101.0, "score": 1,
                         "d1": {"bear": 99, "base": 101, "bull": 103},
                         "w1": {"bear": 96, "base": 101, "bull": 106}},
            }
        },
        "2024-01-10": {
            "assets": {
                "TEST": {"p": 103.0, "score": 0,
                         "d1": {"bear": 101, "base": 103, "bull": 105},
                         "w1": {"bear": 98, "base": 103, "bull": 108}},
            }
        },
    }

    new_rows = evaluate(snapshots)
    legacy_rows = legacy.evaluate(snapshots)

    assert len(new_rows) == len(legacy_rows), f"row count: {len(new_rows)} != {len(legacy_rows)}"
    for nr, lr in zip(
        sorted(new_rows, key=lambda r: (r["h"], r["from"], r["t"])),
        sorted(legacy_rows, key=lambda r: (r["h"], r["from"], r["t"])),
    ):
        for k in ("h", "t", "from", "to", "p0", "bear", "base", "bull", "actual"):
            assert nr[k] == lr[k], f"mismatch at {k}: {nr[k]} != {lr[k]}"


def test_summarise_matches_legacy():
    """summarise() must match legacy."""
    rows = [
        {"bear": 98, "base": 100, "bull": 102, "actual": 101, "p0": 100, "to": "2024-01-03"},
        {"bear": 95, "base": 100, "bull": 105, "actual": 106, "p0": 99, "to": "2024-01-10"},
        {"bear": 97, "base": 100, "bull": 103, "actual": 96, "p0": 100, "to": "2024-01-15"},
    ]
    new = summarise(rows)
    leg = legacy.summarise(rows)
    for k in ("n", "hit", "mae", "above", "below"):
        assert new[k] == leg[k], f"{k}: {new[k]} != {leg[k]}"
    if leg["dir"] is not None:
        assert abs(new["dir"] - leg["dir"]) < 1e-6


def test_first_due_matches_legacy():
    """first_due() must match legacy for shared horizons."""
    snaps = {"2024-01-02": {}, "2024-01-05": {}}
    new = first_due(snaps, "2024-01-10")
    leg = legacy.first_due(snaps, "2024-01-10")
    for h in leg:
        assert new[h] == leg[h], f"{h}: {new[h]} != {leg[h]}"


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
