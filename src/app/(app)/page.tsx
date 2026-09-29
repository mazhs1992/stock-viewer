import { verifySession } from "@/lib/auth";
import { WatchlistClient } from "./watchlist-client";

export default async function WatchlistPage() {
  const { supabase, profile } = await verifySession();

  // Step 1: Load assets (needed to get tickers for subsequent queries)
  const { data: assets } = await supabase
    .from("assets")
    .select("*")
    .eq("active", true)
    .order("ticker");

  const tickers = (assets || []).map((a) => a.ticker);

  // Step 2: All remaining queries in parallel
  const [
    { data: fundamentals },
    { data: judgments },
    { data: marketArr },
    { data: allPrices },
  ] = await Promise.all([
    supabase
      .from("fundamentals_daily")
      .select("*")
      .in("ticker", tickers)
      .order("date", { ascending: false }),
    supabase
      .from("judgments")
      .select("ticker, score, is_event, summary, date")
      .in("ticker", tickers)
      .order("date", { ascending: false }),
    supabase
      .from("market_daily")
      .select("*")
      .order("date", { ascending: false })
      .limit(1),
    supabase
      .from("prices_daily")
      .select("ticker, close, date")
      .in("ticker", tickers)
      .order("date", { ascending: false })
      .limit(tickers.length * 50),
  ]);

  // Process fundamentals — latest per ticker
  const latestFundamentals: Record<string, typeof fundamentals extends (infer T)[] | null ? T : never> = {};
  for (const f of fundamentals || []) {
    if (!latestFundamentals[f.ticker]) {
      latestFundamentals[f.ticker] = f;
    }
  }

  // Process judgments — latest per ticker
  const latestJudgments: Record<string, { score: number; is_event: boolean; summary: string; date: string }> = {};
  for (const j of judgments || []) {
    if (!latestJudgments[j.ticker]) {
      latestJudgments[j.ticker] = j;
    }
  }

  // Process sparklines — group by ticker, take last 50
  const sparklines: Record<string, number[]> = {};
  const countPerTicker: Record<string, number> = {};
  for (const p of allPrices || []) {
    countPerTicker[p.ticker] = (countPerTicker[p.ticker] || 0) + 1;
    if (countPerTicker[p.ticker] <= 50) {
      if (!sparklines[p.ticker]) sparklines[p.ticker] = [];
      sparklines[p.ticker].unshift(p.close);
    }
  }

  return (
    <WatchlistClient
      assets={assets || []}
      fundamentals={latestFundamentals}
      judgments={latestJudgments}
      market={marketArr?.[0] || null}
      sparklines={sparklines}
      userRole={profile.role}
    />
  );
}
