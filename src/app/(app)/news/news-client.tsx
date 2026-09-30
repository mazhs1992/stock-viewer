"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function sentimentColor(s: number): string {
  if (s > 0) return "text-green-600 dark:text-green-400";
  if (s < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

export function NewsClient({
  dates,
  selectedDate,
  judgments,
  news,
  market,
  assetNames,
}: {
  dates: string[];
  selectedDate: string;
  judgments: {
    id?: number;
    ticker: string;
    summary: string;
    sentiment: number;
    importance: number;
    score: number;
    is_event: boolean;
    tags: string[];
    why: string;
  }[];
  news: {
    ticker: string;
    title: string;
    url: string;
    source_name: string;
    snippet: string;
  }[];
  market: {
    mood: string | null;
    summary: string | null;
    market_note: string | null;
  } | null;
  assetNames: Record<string, string>;
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ειδήσεις</h1>
        <Select
          value={selectedDate}
          onValueChange={(v) => router.push(`/news?date=${v}`)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dates.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Market note */}
      {market && (market.market_note || market.summary) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Σημείωμα αγοράς{" "}
              {market.mood && (
                <Badge variant="outline" className="ml-2">
                  {market.mood}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {market.market_note || market.summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Per-stock cards */}
      {judgments.length === 0 && (
        <p className="text-muted-foreground text-center py-8">
          Δεν υπάρχουν ειδήσεις για αυτή την ημερομηνία.
        </p>
      )}

      {judgments.map((j, idx) => {
        const tickerNews = news.filter((n) => n.ticker === j.ticker);
        return (
          <Card key={j.id ?? `${j.ticker}-${idx}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {j.ticker}{" "}
                  <span className="font-normal text-muted-foreground">
                    {assetNames[j.ticker] || ""}
                  </span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className={sentimentColor(j.sentiment)}>
                    Sentiment: {j.sentiment > 0 ? "+" : ""}
                    {j.sentiment}
                  </span>
                  <Badge variant="outline">Σημασία: {j.importance}</Badge>
                  {j.is_event && (
                    <Badge variant="destructive">EVENT</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {j.summary && <p className="text-sm mb-2">{j.summary}</p>}
              {j.tags.length > 0 && (
                <div className="flex gap-1 mb-3">
                  {j.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}

              {tickerNews.length > 0 && (
                <div className="space-y-1">
                  {tickerNews.map((n, i) => (
                    <div key={i} className="text-xs">
                      <a
                        href={n.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {n.title}
                      </a>
                      <span className="text-muted-foreground ml-1">
                        — {n.source_name}
                      </span>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground mt-2 italic">
                    Περίληψη από Claude βάσει των παραπάνω άρθρων
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
