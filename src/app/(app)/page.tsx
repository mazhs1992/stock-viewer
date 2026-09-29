import { createClient } from "@/lib/supabase/server";
import { WatchlistClient } from "./watchlist-client";

export default async function WatchlistPage() {
  const supabase = await createClient();

  // Load assets
  const { data: assets } = await supabase
    .from("assets")
    .select("*")
    .eq("active", true)
    .order("ticker");

  // Load latest fundamentals for each asset
  const tickers = (assets || []).map((a) => a.ticker);
  const { data: fundamentals } = await supabase
    .from("fundamentals_daily")
    .select("*")
    .in("ticker", tickers)
    .order("date", { ascending: false });

  // Get latest per ticker
  const latestFundamentals: Record<string, typeof fundamentals extends (infer T)[] | null ? T : never> = {};
  for (const f of fundamentals || []) {
    if (!latestFundamentals[f.ticker]) {
      latestFundamentals[f.ticker] = f;
    }
  }

  // Load latest judgments
  const { data: judgments } = await supabase
    .from("judgments")
    .select("ticker, score, is_event, summary, date")
    .in("ticker", tickers)
    .order("date", { ascending: false });

  const latestJudgments: Record<string, { score: number; is_event: boolean; summary: string; date: string }> = {};
  for (const j of judgments || []) {
    if (!latestJudgments[j.ticker]) {
      latestJudgments[j.ticker] = j;
    }
  }

  // Load market daily (latest)
  const { data: marketArr } = await supabase
    .from("market_daily")
    .select("*")
    .order("date", { ascending: false })
    .limit(1);
  const market = marketArr?.[0] || null;

  // Load sparkline data (last 50 closes per ticker)
  const sparklines: Record<string, number[]> = {};
  for (const t of tickers) {
    const { data: prices } = await supabase
      .from("prices_daily")
      .select("close")
      .eq("ticker", t)
      .order("date", { ascending: false })
      .limit(50);
    if (prices) {
      sparklines[t] = prices.map((p) => p.close).reverse();
    }
  }

  // Get user profile for role check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user!.id)
    .single();

  return (
    <WatchlistClient
      assets={assets || []}
      fundamentals={latestFundamentals}
      judgments={latestJudgments}
      market={market}
      sparklines={sparklines}
      userRole={profile?.role || "member"}
    />
  );
}
