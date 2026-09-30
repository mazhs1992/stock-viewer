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

function sentimentLabel(s: number): string {
  if (s >= 2) return "Πολύ θετικό";
  if (s === 1) return "Θετικό";
  if (s === 0) return "Ουδέτερο";
  if (s === -1) return "Αρνητικό";
  return "Πολύ αρνητικό";
}

function ratingLabel(r: number): string {
  if (r >= 4.5) return "Strong Buy";
  if (r >= 3.5) return "Buy";
  if (r >= 2.5) return "Hold";
  if (r >= 1.5) return "Sell";
  return "Strong Sell";
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
  const latestJudgment = judgments[0];

  // Group predictions by date to get latest set
  const latestPredDate = predictions[0]?.date;
  const latestPreds = predictions.filter((p) => p.date === latestPredDate);

  // Build price chart data with prediction bands overlaid
  const chartData = prices.map((p) => {
    const cronPreds = predictions.filter(
      (pr) => pr.date === p.date && pr.horizon === "m1"
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

  // 52w range position
  const rangePosition =
    latest?.low52 && latest?.high52 && latest.high52 !== latest.low52
      ? ((latest.price - latest.low52) / (latest.high52 - latest.low52)) * 100
      : null;

  // Target upside/downside
  const targetPct =
    latest?.target && latest.price
      ? ((latest.target - latest.price) / latest.price) * 100
      : null;

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

      {/* Info cards row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Company info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Εταιρεία</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Κλάδος</span>
              <span>{asset.sector || "—"}</span>
            </div>
            {latest && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">P/E</span>
                  <span className="font-mono">{latest.pe?.toFixed(1) ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Forward P/E</span>
                  <span className="font-mono">{latest.fpe?.toFixed(1) ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Beta</span>
                  <span className="font-mono">{latest.beta?.toFixed(2) ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Επόμ. κέρδη</span>
                  <span className="font-mono">{latest.next_earnings ?? "—"}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Analyst consensus */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Αναλυτές</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {latest ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Σύσταση</span>
                  <span className="font-medium">
                    {latest.rating
                      ? `${ratingLabel(latest.rating)} (${latest.rating.toFixed(1)})`
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Στόχος τιμής</span>
                  <span className="font-mono">
                    {latest.target ? (
                      <>
                        ${latest.target.toFixed(2)}{" "}
                        <span
                          className={
                            targetPct && targetPct >= 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }
                        >
                          ({targetPct && targetPct >= 0 ? "+" : ""}
                          {targetPct?.toFixed(1)}%)
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Αναλυτές</span>
                  <span className="font-mono">{latest.analysts ?? "—"}</span>
                </div>
                {/* 52w range bar */}
                {latest.low52 && latest.high52 && (
                  <div className="pt-1">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>${latest.low52.toFixed(0)}</span>
                      <span className="text-[10px]">52 εβδ.</span>
                      <span>${latest.high52.toFixed(0)}</span>
                    </div>
                    <div className="relative h-2 rounded-full bg-muted">
                      {rangePosition != null && (
                        <div
                          className="absolute top-0 h-2 w-2 rounded-full bg-foreground"
                          style={{ left: `calc(${Math.min(100, Math.max(0, rangePosition))}% - 4px)` }}
                        />
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Δεν υπάρχουν δεδομένα.</p>
            )}
          </CardContent>
        </Card>

        {/* Latest AI judgment */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">AI Ανάλυση</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {latestJudgment ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Score</span>
                  <span className={`font-bold ${scoreColor(latestJudgment.score)}`}>
                    {latestJudgment.score > 0 ? `+${latestJudgment.score}` : latestJudgment.score}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sentiment</span>
                  <span className={scoreColor(latestJudgment.sentiment)}>
                    {sentimentLabel(latestJudgment.sentiment)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Σημασία</span>
                  <span>{latestJudgment.importance}/5</span>
                </div>
                {latestJudgment.is_event && (
                  <Badge variant="destructive" className="mt-1">EVENT</Badge>
                )}
                {latestJudgment.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {latestJudgment.tags.map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground pt-1">
                  {latestJudgment.date}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">Δεν υπάρχει ανάλυση ακόμα.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI summary block */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm">Τι λέει ο Claude</CardTitle>
            {latestJudgment && (
              <span className="text-xs text-muted-foreground">
                ({latestJudgment.date})
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {latestJudgment?.summary ? (
            <>
              <p className="text-sm">{latestJudgment.summary}</p>
              {latestJudgment.why && (
                <p className="text-xs text-muted-foreground italic">
                  {latestJudgment.why}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Δεν υπάρχει ανάλυση ακόμα. Θα εμφανιστεί μόλις τρέξει σωστά το AI pipeline.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Latest projections table */}
      {latestPreds.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm">Προβλέψεις</CardTitle>
              <span className="text-xs text-muted-foreground">
                ({latestPredDate})
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ορίζοντας</TableHead>
                    <TableHead className="text-right">Bear</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">Bull</TableHead>
                    <TableHead className="text-right">Bear %</TableHead>
                    <TableHead className="text-right">Base %</TableHead>
                    <TableHead className="text-right">Bull %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {["d1", "w1", "m1", "m3", "m6", "y1"].map((h) => {
                    const pred = latestPreds.find((p) => p.horizon === h);
                    if (!pred) return null;
                    const pctBear = ((pred.bear - pred.price0) / pred.price0) * 100;
                    const pctBase = ((pred.base - pred.price0) / pred.price0) * 100;
                    const pctBull = ((pred.bull - pred.price0) / pred.price0) * 100;
                    return (
                      <TableRow key={h}>
                        <TableCell className="font-medium">
                          {HORIZON_LABELS[h]}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${pred.bear.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${pred.base.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${pred.bull.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-500/70 dark:text-red-400/70">
                          {pctBear >= 0 ? "+" : ""}{pctBear.toFixed(1)}%
                        </TableCell>
                        <TableCell className={`text-right font-mono font-semibold ${
                          pctBase >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        }`}>
                          {pctBase >= 0 ? "+" : ""}{pctBase.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-500/70 dark:text-green-400/70">
                          {pctBull >= 0 ? "+" : ""}{pctBull.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Vol: {(latestPreds[0].vol * 100).toFixed(1)}% · Mu: {(latestPreds[0].mu * 100).toFixed(1)}% · Score: {latestPreds[0].score}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="chart">
        <TabsList>
          <TabsTrigger value="chart">Γράφημα</TabsTrigger>
          <TabsTrigger value="timeline">Χρονολόγιο</TabsTrigger>
          <TabsTrigger value="news">Ειδήσεις</TabsTrigger>
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
            {judgments.map((j, i) => (
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
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* News */}
        <TabsContent value="news">
          <div className="space-y-2">
            {news.length === 0 && (
              <p className="text-muted-foreground">
                Δεν υπάρχουν ειδήσεις.
              </p>
            )}
            {news.map((n, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b last:border-0">
                <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                  {n.date}
                </span>
                <div className="min-w-0">
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {n.title}
                  </a>
                  <span className="text-xs text-muted-foreground ml-2">
                    {n.source_name}
                  </span>
                </div>
              </div>
            ))}
          </div>
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
