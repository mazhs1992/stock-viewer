"""Claude analysis: per-ticker judgments and market analysis."""
import json
import anthropic
import trafilatura
import httpx

from ..config import ANTHROPIC_API_KEY, ANTHROPIC_MODEL, ANTHROPIC_WORKSPACE_ID
from .prompts import TICKER_SYSTEM, TICKER_TEMPLATE, MARKET_SYSTEM, MARKET_TEMPLATE


def analyze_all(
    collected: dict,
    market: dict,
    trading_date: str,
    run_kind: str,
) -> tuple[dict, dict, dict]:
    """Run Claude analysis for all tickers + market.

    Returns: (judgments, market_analysis, tokens)
    - judgments: {ticker: {score, is_event, why, summary, sentiment, importance, tags, used_urls}}
    - market_analysis: {mood, summary, market_note}
    - tokens: {input, output}
    """
    kwargs: dict = {"api_key": ANTHROPIC_API_KEY}
    if ANTHROPIC_WORKSPACE_ID:
        kwargs["default_headers"] = {"anthropic-workspace-id": ANTHROPIC_WORKSPACE_ID}
    client = anthropic.Anthropic(**kwargs)
    total_in = 0
    total_out = 0
    judgments = {}

    # Per-ticker analysis
    for ticker, data in collected.items():
        print(f"  Analyzing {ticker}...")
        news_text = _format_news(data.get("news", []))
        article_text = _fetch_articles(data.get("news", []))
        provided_urls = [n["url"] for n in data.get("news", []) if n.get("url")]

        prompt = TICKER_TEMPLATE.format(
            ticker=ticker,
            name=data.get("name", ticker),
            sector=data.get("sector", ""),
            price=data.get("price", 0),
            change_pct=data.get("change_pct") or 0,
            analysts=data.get("analysts") or "N/A",
            target=data.get("target") or "N/A",
            next_earnings=data.get("next_earnings") or "N/A",
            news_text=news_text or "Δεν βρέθηκαν ειδήσεις.",
            article_text=article_text,
        )

        result, tokens = _call_claude(client, TICKER_SYSTEM, prompt)
        total_in += tokens[0]
        total_out += tokens[1]

        if result:
            # Validate used_urls
            if "used_urls" in result:
                result["used_urls"] = [u for u in result["used_urls"] if u in provided_urls]
            judgments[ticker] = result
            print(f"    Score: {result.get('score', '?')}, importance: {result.get('importance', '?')}")
        else:
            judgments[ticker] = {"score": 0, "is_event": False, "why": "Αποτυχία ανάλυσης",
                                 "summary": "", "sentiment": 0, "importance": 0, "tags": [], "used_urls": []}

    # Market analysis
    print(f"  Analyzing market...")
    # Check if we have accuracy data for note
    accuracy_note = ""
    market_prompt = MARKET_TEMPLATE.format(
        date=trading_date,
        fear_greed=market.get("fear_greed") or "N/A",
        fear_greed_label=market.get("fear_greed_label") or "N/A",
        fear_greed_prev_week=market.get("fear_greed_prev_week") or "N/A",
        vix=market.get("vix") or "N/A",
        us10y=market.get("us10y") or "N/A",
        accuracy_note=accuracy_note,
    )

    market_result, m_tokens = _call_claude(client, MARKET_SYSTEM, market_prompt)
    total_in += m_tokens[0]
    total_out += m_tokens[1]

    if not market_result:
        market_result = {"mood": "Ουδέτερο", "summary": "", "market_note": ""}

    return judgments, market_result, {"input": total_in, "output": total_out}


def _call_claude(client: anthropic.Anthropic, system: str, prompt: str, retries: int = 1) -> tuple[dict | None, tuple[int, int]]:
    """Call Claude API with JSON output, retry on invalid JSON."""
    for attempt in range(retries + 1):
        try:
            resp = client.messages.create(
                model=ANTHROPIC_MODEL,
                max_tokens=1024,
                system=system,
                messages=[{"role": "user", "content": prompt}],
            )
            text = resp.content[0].text
            tokens = (resp.usage.input_tokens, resp.usage.output_tokens)

            # Parse JSON (handle markdown code blocks)
            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                text = text.rsplit("```", 1)[0]
            result = json.loads(text)
            return result, tokens
        except json.JSONDecodeError:
            if attempt < retries:
                print(f"    Invalid JSON, retrying...")
                continue
            print(f"    Invalid JSON after {retries + 1} attempts")
            return None, (0, 0)
        except Exception as e:
            print(f"    Claude error: {e}")
            return None, (0, 0)


def _format_news(news: list[dict]) -> str:
    """Format news items for the prompt."""
    lines = []
    for i, n in enumerate(news[:8], 1):
        line = f"{i}. [{n.get('source_name', '')}] {n.get('title', '')}"
        if n.get("snippet"):
            line += f"\n   {n['snippet'][:200]}"
        if n.get("url"):
            line += f"\n   URL: {n['url']}"
        lines.append(line)
    return "\n".join(lines)


def _fetch_articles(news: list[dict], max_articles: int = 3, max_chars: int = 4000) -> str:
    """Fetch and extract full text of the top articles."""
    articles = []
    for n in news[:max_articles]:
        url = n.get("url", "")
        if not url:
            continue
        try:
            resp = httpx.get(url, timeout=10, follow_redirects=True,
                             headers={"User-Agent": "StockViewer/1.0 (research)"})
            if resp.status_code != 200:
                continue
            text = trafilatura.extract(resp.text, include_comments=False, include_tables=False)
            if text:
                # Truncate to ~4k tokens (~4k chars)
                text = text[:max_chars]
                articles.append(f"--- Πλήρες κείμενο: {n.get('title', '')} ---\n{text}")
        except Exception:
            continue

    if articles:
        return "\n\n".join(articles)
    return ""
