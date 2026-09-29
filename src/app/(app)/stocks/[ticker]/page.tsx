import { notFound } from "next/navigation";
import { verifySession } from "@/lib/auth";
import { StockClient } from "./stock-client";

export default async function StockPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const { supabase } = await verifySession();

  // Check asset exists
  const { data: asset } = await supabase
    .from("assets")
    .select("*")
    .eq("ticker", ticker)
    .single();

  if (!asset) notFound();

  // Load latest fundamentals
  const { data: fundamentals } = await supabase
    .from("fundamentals_daily")
    .select("*")
    .eq("ticker", ticker)
    .order("date", { ascending: false })
    .limit(30);

  // Load prices (last 90 days)
  const { data: prices } = await supabase
    .from("prices_daily")
    .select("date, close")
    .eq("ticker", ticker)
    .order("date", { ascending: false })
    .limit(90);

  // Load predictions
  const { data: predictions } = await supabase
    .from("predictions")
    .select("*")
    .eq("ticker", ticker)
    .order("date", { ascending: false })
    .limit(100);

  // Load judgments (daily timeline)
  const { data: judgments } = await supabase
    .from("judgments")
    .select("*")
    .eq("ticker", ticker)
    .order("date", { ascending: false })
    .limit(30);

  // Load news
  const { data: news } = await supabase
    .from("news_items")
    .select("*")
    .eq("ticker", ticker)
    .order("date", { ascending: false })
    .limit(50);

  // Load accuracy for this ticker
  const { data: accuracy } = await supabase
    .from("accuracy")
    .select("*")
    .eq("scope", ticker);

  return (
    <StockClient
      asset={asset}
      fundamentals={fundamentals || []}
      prices={(prices || []).reverse()}
      predictions={predictions || []}
      judgments={judgments || []}
      news={news || []}
      accuracy={accuracy || []}
    />
  );
}
