"use client";

import {
  LineChart,
  Line,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const HORIZON_LABELS: Record<string, string> = {
  d1: "1 Ημέρα",
  w1: "1 Εβδ.",
  m1: "1 Μήνα",
  m3: "3 Μήνες",
  m6: "6 Μήνες",
  y1: "1 Έτος",
};

function scoreColor(score: number): string {
  if (score >= 1) return "text-green-600 dark:text-green-400";
  if (score <= -1) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

export function StockClient({
  asset,
  fundamentals,
  prices,
  predictions,
  judgments,
  news,
  accuracy,
}: {
  asset: { ticker: string; name: string; sector: string };
  fundamentals: {
    date: string;
    price: number;
    chg_pct: number;
    pe: number | null;
    fpe: number | null;
    rating: number | null;
    target: number | null;
    analysts: number | null;
    next_earnings: string | null;
    low52: number | null;
    high52: number | null;
    beta: number | null;
    source_ids: Record<string, string>;
  }[];
  prices: { date: string; close: number }[];
  predictions: {
    date: string;
    horizon: string;
    run_kind: string;
    price0: number;
    bear: number;
    base: number;
    bull: number;
    vol: number;
    mu: number;
    score: number;
    model_version: string;
    run_id: string;
  }[];
  judgments: {
    date: string;
    score: number;
    is_event: boolean;
    why: string;
    summary: string;
    sentiment: number;
    importance: number;
    tags: string[];
    run_id: string;
  }[];
  news: {
    date: string;
    title: string;
    url: string;
    source_name: string;
    snippet: string;
  }[];
  accuracy: {
    horizon: string;
    win: string;
    n: number;
    hit_rate: number | null;
    mae: number | null;
    direction_rate: number | null;
  }[];
}) {
  const latest = fundamentals[0];

  // Build price chart data with prediction bands overlaid
  const chartData = prices.map((p) => {
    const cronPreds = predictions.filter(
      (pr) => pr.run_kind === "cron" && pr.date === p.date && pr.horizon === "m1"
    );
    const pred = cronPreds[0];
    return {
      date: p.date,
      close: p.close,
      bear: pred?.bear,
      base: pred?.base,
      bull: pred?.bull,
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{asset.ticker}</h1>
          <span className="text-muted-foreground">{asset.name}</span>
          {asset.sector && (
            <Badge variant="secondary">{asset.sector}</Badge>
          )}
        </div>
        {latest && (
          <div className="mt-2 flex flex-wrap items-baseline gap-4">
            <span className="text-3xl font-bold font-mono">
              ${latest.price.toFixed(2)}
            </span>
            <span
              className={`text-lg font-mono ${
                latest.chg_pct > 0
                  ? "text-green-600 dark:text-green-400"
                  : latest.chg_pct < 0
                    ? "text-red-600 dark:text-red-400"
                    : ""
              }`}
            >
              {latest.chg_pct > 0 ? "+" : ""}
              {latest.chg_pct?.toFixed(2)}%
            </span>
            <span className="text-xs text-muted-foreground">{latest.date}</span>
          </div>
        )}
      </div>

      <Tabs defaultValue="chart">
        <TabsList>
          <TabsTrigger value="chart">Γράφημα</TabsTrigger>
          <TabsTrigger value="timeline">Χρονολόγιο</TabsTrigger>
          <TabsTrigger value="analyst">Αναλυτές</TabsTrigger>
          <TabsTrigger value="diagnostics">Διαγνωστικά</TabsTrigger>
        </TabsList>

        {/* Price Chart */}
        <TabsContent value="chart">
          <Card>
            <CardContent className="pt-6">
              {chartData.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => v.slice(5)}
                      />
                      <YAxis
                        domain={["auto", "auto"]}
                        tick={{ fontSize: 10 }}
                        width={60}
                      />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="bull"
                        stroke="none"
                        fill="#22c55e"
                        fillOpacity={0.1}
                      />
                      <Area
                        type="monotone"
                        dataKey="bear"
                        stroke="none"
                        fill="#ef4444"
                        fillOpacity={0.1}
                      />
                      <Line
                        type="monotone"
                        dataKey="base"
                        stroke="#8884d8"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="close"
                        stroke="currentColor"
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Δεν υπάρχουν δεδομένα τιμών.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline">
          <div className="space-y-4">
            {judgments.length === 0 && (
              <p className="text-muted-foreground">
                Δεν υπάρχουν αναλύσεις ακόμα.
              </p>
            )}
            {judgments.map((j, i) => {
              const dayNews = news.filter((n) => n.date === j.date);
              return (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{j.date}</CardTitle>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold ${scoreColor(j.score)}`}
                        >
                          Score: {j.score > 0 ? `+${j.score}` : j.score}
                        </span>
                        {j.is_event && (
                          <Badge variant="destructive">EVENT</Badge>
                        )}
                        {j.tags.map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px]">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {j.summary && (
                      <p className="text-sm mb-2">{j.summary}</p>
                    )}
                    {j.why && (
                      <p className="text-xs text-muted-foreground mb-2">
                        {j.why}
                      </p>
                    )}
                    {dayNews.length > 0 && (
                      <ul className="space-y-1 mt-2">
                        {dayNews.map((n, ni) => (
                          <li key={ni} className="text-xs">
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
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Analyst data */}
        <TabsContent value="analyst">
          <Card>
            <CardContent className="pt-6">
              {latest ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <span className="text-xs text-muted-foreground">P/E</span>
                    <p className="font-mono">
                      {latest.pe?.toFixed(1) ?? "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Forward P/E
                    </span>
                    <p className="font-mono">
                      {latest.fpe?.toFixed(1) ?? "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Rating
                    </span>
                    <p className="font-mono">
                      {latest.rating?.toFixed(1) ?? "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Target
                    </span>
                    <p className="font-mono">
                      {latest.target ? `$${latest.target.toFixed(2)}` : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Αναλυτές
                    </span>
                    <p className="font-mono">{latest.analysts ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Beta</span>
                    <p className="font-mono">
                      {latest.beta?.toFixed(2) ?? "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      52w Low
                    </span>
                    <p className="font-mono">
                      {latest.low52 ? `$${latest.low52.toFixed(2)}` : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      52w High
                    </span>
                    <p className="font-mono">
                      {latest.high52 ? `$${latest.high52.toFixed(2)}` : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Επόμενα κέρδη
                    </span>
                    <p className="font-mono">
                      {latest.next_earnings ?? "—"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Δεν υπάρχουν δεδομένα αναλυτών.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Diagnostics */}
        <TabsContent value="diagnostics">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Προέλευση δεδομένων</CardTitle>
            </CardHeader>
            <CardContent>
              {latest?.source_ids &&
              Object.keys(latest.source_ids).length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Πεδίο</TableHead>
                      <TableHead>Source ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(latest.source_ids).map(([field, sid]) => (
                      <TableRow key={field}>
                        <TableCell className="font-mono text-sm">
                          {field}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {String(sid)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Δεν υπάρχουν δεδομένα προέλευσης.
                </p>
              )}

              {/* Latest prediction diagnostics */}
              {predictions.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium mb-2">
                    Τελευταία πρόβλεψη
                  </h3>
                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <span className="text-muted-foreground">Vol: </span>
                      <span className="font-mono">
                        {(predictions[0].vol * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Mu: </span>
                      <span className="font-mono">
                        {(predictions[0].mu * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Model: </span>
                      <span className="font-mono">
                        {predictions[0].model_version}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Run: </span>
                      <span className="font-mono text-[10px]">
                        {predictions[0].run_id.slice(0, 8)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
