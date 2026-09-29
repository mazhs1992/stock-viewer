import { verifySession } from "@/lib/auth";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const { supabase } = await verifySession();

  // Load active assets
  const { data: assets } = await supabase
    .from("assets")
    .select("ticker, name")
    .eq("active", true)
    .order("ticker");
  const tickers = (assets || []).map((a) => a.ticker);

  // Load predictions + accuracy in parallel
  const [{ data: predictions }, { data: accuracy }] = await Promise.all([
    supabase
      .from("predictions")
      .select("ticker, date, horizon, run_kind, price0, bear, base, bull, vol, mu, score")
      .in("ticker", tickers)
      .order("date", { ascending: false }),
    supabase
      .from("accuracy")
      .select("*")
      .order("scope")
      .order("horizon"),
  ]);

  // Group by ticker: latest predictions
  const latestPredictions: Record<
    string,
    {
      date: string;
      price0: number;
      vol: number;
      mu: number;
      score: number;
      horizons: Record<string, { bear: number; base: number; bull: number }>;
    }
  > = {};

  for (const p of predictions || []) {
    if (!latestPredictions[p.ticker]) {
      latestPredictions[p.ticker] = {
        date: p.date,
        price0: p.price0,
        vol: p.vol,
        mu: p.mu,
        score: p.score,
        horizons: {},
      };
    }
    if (p.date === latestPredictions[p.ticker].date) {
      latestPredictions[p.ticker].horizons[p.horizon] = {
        bear: p.bear,
        base: p.base,
        bull: p.bull,
      };
    }
  }

  return (
    <DashboardClient
      assets={assets || []}
      predictions={latestPredictions}
      accuracy={accuracy || []}
    />
  );
}
