"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function statusBadge(status: string, startedAt: string | null) {
  switch (status) {
    case "ok":
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-0">
          OK
        </Badge>
      );
    case "running":
      return (
        <Badge variant="secondary" className="animate-pulse">
          Εκτέλεση...
        </Badge>
      );
    case "queued": {
      // If queued for more than 10 minutes, show as stale
      const isStale =
        startedAt &&
        Date.now() - new Date(startedAt).getTime() > 10 * 60 * 1000;
      return (
        <Badge
          variant="outline"
          className={isStale ? "border-yellow-500 text-yellow-600 dark:text-yellow-400" : ""}
        >
          {isStale ? "Εκκρεμεί" : "Αναμονή"}
        </Badge>
      );
    }
    case "partial":
      return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white border-0">Μερικό</Badge>;
    case "failed":
      return <Badge variant="destructive">Αποτυχία</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function duration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const secs = Math.round((e - s) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("el-GR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Run = {
  id: string;
  kind: string;
  scope: string;
  status: string;
  trading_date: string;
  started_at: string | null;
  finished_at: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_usd: number | null;
  errors: string | null;
  log: string | null;
};

export function RunsClient({
  runs: initialRuns,
  isAdmin,
  monthlyCosts,
}: {
  runs: Run[];
  isAdmin: boolean;
  monthlyCosts: Record<string, number>;
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState("");

  // Poll for active runs
  const hasActive = runs.some(
    (r) => r.status === "running" || r.status === "queued"
  );

  const pollRuns = useCallback(async () => {
    try {
      const resp = await fetch("/api/runs");
      if (resp.ok) {
        const data = await resp.json();
        setRuns(data.runs);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!hasActive) return;
    const interval = setInterval(pollRuns, 5000);
    return () => clearInterval(interval);
  }, [hasActive, pollRuns]);

  async function handleTrigger(kind: "manual" | "cron") {
    setTriggering(true);
    setTriggerError("");
    try {
      const resp = await fetch("/api/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setTriggerError(data.error || "Αποτυχία");
      } else {
        setRuns((prev) => [
          {
            id: data.run_id,
            kind,
            scope: "all",
            status: "queued",
            trading_date: new Date().toISOString().slice(0, 10),
            started_at: new Date().toISOString(),
            finished_at: null,
            tokens_in: null,
            tokens_out: null,
            cost_usd: null,
            errors: null,
            log: null,
          },
          ...prev,
        ]);
      }
    } catch {
      setTriggerError("Σφάλμα δικτύου");
    }
    setTriggering(false);
  }

  const totalTokens = (r: Run) => {
    const t = (r.tokens_in || 0) + (r.tokens_out || 0);
    return t > 0 ? `${(t / 1000).toFixed(1)}k` : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Εκτελέσεις</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => handleTrigger("manual")}
              disabled={triggering}
            >
              {triggering ? "..." : "Τρέξε τώρα"}
            </Button>
          </div>
        )}
      </div>

      {triggerError && (
        <p className="text-sm text-destructive">{triggerError}</p>
      )}

      {/* Monthly costs — only show if there's actual cost */}
      {Object.values(monthlyCosts).some((c) => c > 0) && (
        <div className="flex flex-wrap gap-4">
          {Object.entries(monthlyCosts)
            .sort()
            .reverse()
            .slice(0, 3)
            .map(([month, cost]) => (
              <Card key={month} className="flex-1 min-w-[140px]">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs text-muted-foreground">
                    {month}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-mono font-bold">
                    ${cost.toFixed(2)}
                  </p>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Runs table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Τύπος</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Ημ/νία & Ώρα</TableHead>
              <TableHead className="text-center">Κατάσταση</TableHead>
              <TableHead className="text-right">Διάρκεια</TableHead>
              <TableHead className="text-right hidden sm:table-cell">
                Tokens
              </TableHead>
              <TableHead className="hidden md:table-cell">Σφάλματα</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Badge variant="outline">{r.kind}</Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">{r.scope}</TableCell>
                <TableCell className="text-sm">
                  {formatDateTime(r.started_at)}
                </TableCell>
                <TableCell className="text-center">
                  {statusBadge(r.status, r.started_at)}
                </TableCell>
                <TableCell className="text-right text-xs font-mono">
                  {r.status === "queued" ? "—" : duration(r.started_at, r.finished_at)}
                </TableCell>
                <TableCell className="text-right text-xs font-mono hidden sm:table-cell">
                  {totalTokens(r) || "—"}
                </TableCell>
                <TableCell className="hidden md:table-cell text-xs text-destructive max-w-[200px] truncate">
                  {r.errors
                    ? (() => {
                        try {
                          const e = JSON.parse(r.errors);
                          return e.message || e.exception?.slice(0, 80) || r.errors;
                        } catch {
                          return r.errors;
                        }
                      })()
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
            {runs.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  Δεν υπάρχουν εκτελέσεις.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
