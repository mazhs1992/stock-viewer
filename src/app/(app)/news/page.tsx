import { verifySession } from "@/lib/auth";
import { NewsClient } from "./news-client";

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const { supabase } = await verifySession();

  // Get available dates
  const { data: dates } = await supabase
    .from("judgments")
    .select("date")
    .order("date", { ascending: false })
    .limit(30);

  const uniqueDates = [...new Set((dates || []).map((d) => d.date))];
  const selectedDate = dateParam || uniqueDates[0] || "";

  // Load judgments for the selected date
  const { data: judgments } = await supabase
    .from("judgments")
    .select("*")
    .eq("date", selectedDate)
    .order("importance", { ascending: false });

  // Load news for the selected date
  const { data: news } = await supabase
    .from("news_items")
    .select("*")
    .eq("date", selectedDate)
    .order("ticker");

  // Load market note
  const { data: marketArr } = await supabase
    .from("market_daily")
    .select("*")
    .eq("date", selectedDate)
    .limit(1);
  const market = marketArr?.[0] || null;

  // Load asset names
  const tickers = [...new Set((judgments || []).map((j) => j.ticker))];
  const { data: assets } = await supabase
    .from("assets")
    .select("ticker, name")
    .in("ticker", tickers.length > 0 ? tickers : ["__none__"]);

  const assetNames: Record<string, string> = {};
  for (const a of assets || []) {
    assetNames[a.ticker] = a.name;
  }

  return (
    <NewsClient
      dates={uniqueDates}
      selectedDate={selectedDate}
      judgments={judgments || []}
      news={news || []}
      market={market}
      assetNames={assetNames}
    />
  );
}
