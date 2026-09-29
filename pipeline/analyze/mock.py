"""Mock analysis using legacy day judgments. No API calls."""
import json
import os

LEGACY_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "legacy", "data")


def analyze_all_mock(
    collected: dict, market: dict, trading_date: str
) -> tuple[dict, dict, dict]:
    """Return mock judgments from legacy days data."""
    # Load most recent days file
    days_dir = os.path.join(LEGACY_DIR, "days")
    day_data = {}
    if os.path.isdir(days_dir):
        files = sorted(os.listdir(days_dir), reverse=True)
        for fname in files:
            if fname.endswith(".json"):
                day_data = json.load(open(os.path.join(days_dir, fname)))
                break

    judgments = {}
    for ticker in collected:
        item = day_data.get("items", {}).get(ticker, {})
        judgments[ticker] = {
            "score": 0,
            "is_event": False,
            "why": item.get("summary", "Mock: κανένα νέο σήμερα"),
            "summary": item.get("summary", ""),
            "sentiment": item.get("sentiment", 0),
            "importance": item.get("importance", 0),
            "tags": item.get("tags", []),
            "used_urls": [],
        }
        print(f"  Mock analysis {ticker}: score=0")

    market_analysis = {
        "mood": "Ουδέτερο",
        "summary": "Mock: δεν υπάρχει πραγματική ανάλυση αγοράς.",
        "market_note": day_data.get("marketNote", ""),
    }
    print(f"  Mock market analysis: mood=Ουδέτερο")

    return judgments, market_analysis, {"input": 0, "output": 0}
