"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FanChart } from "@/components/fan-chart";

const HORIZONS = ["d1", "w1", "m1", "m3", "m6", "y1"] as const;
const HORIZON_LABELS: Record<string, string> = {
  d1: "1 Ημέρα",
  w1: "1 Εβδ.",
  m1: "1 Μήνα",
  m3: "3 Μήνες",
  m6: "6 Μήνες",
  y1: "1 Έτος",
};

const WIN_LABELS: Record<string, string> = {
  w1: "Εβδομάδα",
  m1: "Μήνας",
  m3: "3 Μήνες",
  m6: "6 Μήνες",
  all: "Σύνολο",
};

type Prediction = {
  date: string;
  price0: number;
  vol: number;
  mu: number;
  score: number;
  horizons: Record<string, { bear: number; base: number; bull: number }>;
};

type AccuracyRow = {
  scope: string;
  horizon: string;
  win: string;
  n: number;
  hit_rate: number | null;
  mae: number | null;
  direction_rate: number | null;
  above: number | null;
  below: number | null;
  first_due: string | null;
};

export function DashboardClient({
  assets,
  predictions,
  accuracy,
}: {
  assets: { ticker: string; name: string }[];
  predictions: Record<string, Prediction>;
  accuracy: AccuracyRow[];
}) {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Projections */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Προβλέψεις</h2>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticker</TableHead>
                <TableHead className="text-right">Τιμή</TableHead>
                {HORIZONS.map((h) => (
                  <TableHead key={h} className="text-center">
                    {HORIZON_LABELS[h]}
                  </TableHead>
                ))}
                <TableHead className="hidden lg:table-cell">Chart</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => {
                const pred = predictions[asset.ticker];
                if (!pred) {
                  return (
                    <TableRow key={asset.ticker}>
                      <TableCell className="font-medium">{asset.ticker}</TableCell>
                      <TableCell colSpan={HORIZONS.length + 2} className="text-muted-foreground text-center">
                        Δεν υπάρχουν προβλέψεις
                      </TableCell>
                    </TableRow>
                  );
                }
                return (
                  <TableRow key={asset.ticker}>
                    <TableCell className="font-medium">{asset.ticker}</TableCell>
                    <TableCell className="text-right font-mono">
                      ${pred.price0.toFixed(2)}
                    </TableCell>
                    {HORIZONS.map((h) => {
                      const proj = pred.horizons[h];
                      if (!proj) {
                        return (
                          <TableCell key={h} className="text-center text-muted-foreground">
                            —
                          </TableCell>
                        );
                      }
                      const pctBear = ((proj.bear - pred.price0) / pred.price0) * 100;
                      const pctBase = ((proj.base - pred.price0) / pred.price0) * 100;
                      const pctBull = ((proj.bull - pred.price0) / pred.price0) * 100;
                      const baseColor = pctBase >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400";
                      return (
                        <TableCell key={h} className="text-center text-xs font-mono">
                          <div className="text-red-500/70 dark:text-red-400/70">
                            {pctBear >= 0 ? "+" : ""}{pctBear.toFixed(1)}%
                          </div>
                          <div className={`font-semibold ${baseColor}`}>
                            {pctBase >= 0 ? "+" : ""}{pctBase.toFixed(1)}%
                          </div>
                          <div className="text-green-500/70 dark:text-green-400/70">
                            {pctBull >= 0 ? "+" : ""}{pctBull.toFixed(1)}%
                          </div>
                        </TableCell>
                      );
                    })}
                    <TableCell className="hidden lg:table-cell">
                      <FanChart
                        price0={pred.price0}
                        horizons={pred.horizons}
                        width={160}
                        height={60}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Accuracy */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Ακρίβεια</h2>
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">Σύνολο</TabsTrigger>
            {assets.map((a) => (
              <TabsTrigger key={a.ticker} value={a.ticker}>
                {a.ticker}
              </TabsTrigger>
            ))}
          </TabsList>

          {["all", ...assets.map((a) => a.ticker)].map((scope) => {
            const rows = accuracy.filter(
              (r) => r.scope === (scope === "all" ? "ALL" : scope)
            );
            return (
              <TabsContent key={scope} value={scope}>
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    Δεν υπάρχουν δεδομένα ακρίβειας ακόμα.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(WIN_LABELS).map(([win, winLabel]) => {
                      const winRows = rows.filter((r) => r.win === win);
                      if (winRows.length === 0) return null;
                      return (
                        <Card key={win}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">
                              {winLabel}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-1 text-xs">
                              {winRows.map((r) => (
                                <div
                                  key={r.horizon}
                                  className="flex justify-between"
                                >
                                  <span className="text-muted-foreground">
                                    {HORIZON_LABELS[r.horizon] || r.horizon}
                                  </span>
                                  {r.n === 0 ? (
                                    <span className="text-muted-foreground">
                                      διαθ.{" "}
                                      {r.first_due
                                        ? new Date(r.first_due).toLocaleDateString("el")
                                        : "—"}
                                    </span>
                                  ) : (
                                    <span>
                                      {r.hit_rate != null
                                        ? `${(r.hit_rate * 100).toFixed(0)}%`
                                        : "—"}{" "}
                                      <span className="text-muted-foreground">
                                        (n={r.n})
                                      </span>
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </section>
    </div>
  );
}
