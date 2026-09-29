import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Load active assets
  const { data: assets } = await supabase
    .from("assets")
    .select("ticker, name")
    .eq("active", true)
    .order("ticker");
  const tickers = (assets || []).map((a) => a.ticker);

  // Load latest predictions per ticker (all horizons, latest date)
  const { data: predictions } = await supabase
    .from("predictions")
    .select("ticker, date, horizon, run_kind, price0, bear, base, bull, vol, mu, score")
    .in("ticker", tickers)
    .order("date", { ascending: false });

  // Group by ticker: latest cron predictions
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
    if (p.run_kind !== "cron") continue;
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
    // Only take the latest date
    if (p.date === latestPredictions[p.ticker].date) {
      latestPredictions[p.ticker].horizons[p.horizon] = {
        bear: p.bear,
        base: p.base,
        bull: p.bull,
      };
    }
  }

  // Load accuracy
  const { data: accuracy } = await supabase
    .from("accuracy")
    .select("*")
    .order("scope")
    .order("horizon");

  return (
    <DashboardClient
      assets={assets || []}
      predictions={latestPredictions}
      accuracy={accuracy || []}
    />
  );
}
