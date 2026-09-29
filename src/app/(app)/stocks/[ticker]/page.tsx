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

  // Load all ticker data in parallel
  const [
    { data: fundamentals },
    { data: prices },
    { data: predictions },
    { data: judgments },
    { data: news },
    { data: accuracy },
  ] = await Promise.all([
    supabase.from("fundamentals_daily").select("*").eq("ticker", ticker)
      .order("date", { ascending: false }).limit(30),
    supabase.from("prices_daily").select("date, close").eq("ticker", ticker)
      .order("date", { ascending: false }).limit(90),
    supabase.from("predictions").select("*").eq("ticker", ticker)
      .order("date", { ascending: false }).limit(100),
    supabase.from("judgments").select("*").eq("ticker", ticker)
      .order("date", { ascending: false }).limit(30),
    supabase.from("news_items").select("*").eq("ticker", ticker)
      .order("date", { ascending: false }).limit(50),
    supabase.from("accuracy").select("*").eq("scope", ticker),
  ]);

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
