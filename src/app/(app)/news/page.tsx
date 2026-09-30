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

  // Load all data for selected date in parallel
  const [{ data: judgments }, { data: news }, { data: marketArr }, { data: assets }] =
    await Promise.all([
      supabase
        .from("judgments")
        .select("*")
        .eq("date", selectedDate)
        .order("importance", { ascending: false }),
      supabase
        .from("news_items")
        .select("*")
        .eq("date", selectedDate)
        .order("ticker"),
      supabase
        .from("market_daily")
        .select("*")
        .eq("date", selectedDate)
        .limit(1),
      supabase
        .from("assets")
        .select("ticker, name")
        .eq("active", true),
    ]);

  const assetNames: Record<string, string> = {};
  for (const a of assets || []) {
    assetNames[a.ticker] = a.name;
  }

  // Keep only the latest judgment per ticker (highest importance wins)
  const seenTickers = new Set<string>();
  const uniqueJudgments = (judgments || []).filter((j) => {
    if (seenTickers.has(j.ticker)) return false;
    seenTickers.add(j.ticker);
    return true;
  });

  return (
    <NewsClient
      dates={uniqueDates}
      selectedDate={selectedDate}
      judgments={uniqueJudgments}
      news={news || []}
      market={marketArr?.[0] || null}
      assetNames={assetNames}
    />
  );
}
