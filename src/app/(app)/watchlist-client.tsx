"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sparkline } from "@/components/sparkline";
import { addTicker, removeTicker } from "./watchlist-actions";

type Asset = {
  ticker: string;
  name: string;
  sector: string;
  active: boolean;
};

type Fundamental = {
  price: number | null;
  chg_pct: number | null;
  next_earnings: string | null;
  date: string;
};

type Judgment = {
  score: number;
  is_event: boolean;
  summary: string;
  date: string;
};

type Market = {
  date: string;
  mood: string | null;
  fear_greed: number | null;
  fear_greed_label: string | null;
  vix: number | null;
  us10y: number | null;
  summary: string | null;
};

function scoreColor(score: number): string {
  if (score >= 2) return "text-green-600 dark:text-green-400";
  if (score >= 1) return "text-green-500 dark:text-green-500";
  if (score <= -2) return "text-red-600 dark:text-red-400";
  if (score <= -1) return "text-red-500 dark:text-red-500";
  return "text-muted-foreground";
}

function changePctColor(pct: number | null): string {
  if (pct == null) return "";
  if (pct > 0) return "text-green-600 dark:text-green-400";
  if (pct < 0) return "text-red-600 dark:text-red-400";
  return "";
}

export function WatchlistClient({
  assets,
  fundamentals,
  judgments,
  market,
  sparklines,
  userRole,
}: {
  assets: Asset[];
  fundamentals: Record<string, Fundamental>;
  judgments: Record<string, Judgment>;
  market: Market | null;
  sparklines: Record<string, number[]>;
  userRole: string;
}) {
  const [tickerInput, setTickerInput] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd() {
    const t = tickerInput.trim().toUpperCase();
    if (!t) return;
    setAdding(true);
    setError("");
    const result = await addTicker(t);
    setAdding(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setTickerInput("");
      setDialogOpen(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Market bar */}
      {market && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border p-3 text-sm">
          {market.mood && (
            <div>
              <span className="text-muted-foreground">Κλίμα: </span>
              <span className="font-medium">{market.mood}</span>
            </div>
          )}
          {market.fear_greed != null && (
            <div>
              <span className="text-muted-foreground">Fear & Greed: </span>
              <span className="font-medium">
                {market.fear_greed}{" "}
                {market.fear_greed_label && (
                  <span className="text-muted-foreground">
                    ({market.fear_greed_label})
                  </span>
                )}
              </span>
            </div>
          )}
          {market.vix != null && (
            <div>
              <span className="text-muted-foreground">VIX: </span>
              <span className="font-medium">{market.vix.toFixed(2)}</span>
            </div>
          )}
          {market.us10y != null && (
            <div>
              <span className="text-muted-foreground">US 10Y: </span>
              <span className="font-medium">{market.us10y.toFixed(2)}%</span>
            </div>
          )}
          <div className="ml-auto text-xs text-muted-foreground">
            {market.date}
          </div>
        </div>
      )}

      {/* Header + add button */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Watchlist</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 bg-primary text-primary-foreground hover:bg-primary/90">
            + Προσθήκη
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Προσθήκη μετοχής</DialogTitle>
            </DialogHeader>
            <div className="flex gap-2">
              <Input
                placeholder="π.χ. GOOG"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <Button onClick={handleAdd} disabled={adding}>
                {adding ? "..." : "Προσθήκη"}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead className="hidden sm:table-cell">Όνομα</TableHead>
              <TableHead className="text-right">Τιμή</TableHead>
              <TableHead className="text-right">Ημ. %</TableHead>
              <TableHead className="text-center">Score</TableHead>
              <TableHead className="hidden md:table-cell text-center">
                Επόμενα κέρδη
              </TableHead>
              <TableHead className="hidden lg:table-cell">
                50 ημέρες
              </TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((asset) => {
              const f = fundamentals[asset.ticker];
              const j = judgments[asset.ticker];
              const spark = sparklines[asset.ticker];
              return (
                <TableRow key={asset.ticker}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/stocks/${asset.ticker}`}
                      className="hover:underline"
                    >
                      {asset.ticker}
                    </Link>
                    {j?.is_event && (
                      <Badge variant="destructive" className="ml-2 text-[10px]">
                        EVENT
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {asset.name}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {f?.price != null ? `$${f.price.toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono ${changePctColor(f?.chg_pct ?? null)}`}
                  >
                    {f?.chg_pct != null
                      ? `${f.chg_pct > 0 ? "+" : ""}${f.chg_pct.toFixed(2)}%`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {j ? (
                      <span className={`font-bold ${scoreColor(j.score)}`}>
                        {j.score > 0 ? `+${j.score}` : j.score}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-center text-xs text-muted-foreground">
                    {f?.next_earnings || "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {spark && spark.length > 1 && (
                      <Sparkline data={spark} width={100} height={30} />
                    )}
                  </TableCell>
                  <TableCell>
                    {(userRole === "admin" || userRole === "member") && (
                      <form action={removeTicker.bind(null, asset.ticker)}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          ✕
                        </Button>
                      </form>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {assets.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Δεν υπάρχουν μετοχές. Προσθέστε μία!
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
