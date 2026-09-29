"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function statusBadge(source: {
  enabled: boolean;
  last_error: string | null;
  last_ok_at: string | null;
}) {
  if (!source.enabled)
    return <Badge variant="secondary">Απενεργοποιημένο</Badge>;
  if (source.last_error)
    return <Badge variant="destructive">Σφάλμα</Badge>;
  if (source.last_ok_at) return <Badge variant="default">OK</Badge>;
  return <Badge variant="outline">Αναμονή</Badge>;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins} λ.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ώ.`;
  const days = Math.floor(hours / 24);
  return `${days} ημ.`;
}

export function SourcesClient({
  sources,
  isAdmin,
}: {
  sources: {
    id: string;
    name: string;
    kind: string;
    base_url: string;
    provides: string[];
    priority: number;
    enabled: boolean;
    notes: string | null;
    last_ok_at: string | null;
    last_error: string | null;
    last_error_at: string | null;
  }[];
  isAdmin: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Πηγές δεδομένων</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Προσθήκη νέας πηγής χρειάζεται και code adapter στο pipeline.
      </p>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Πηγή</TableHead>
              <TableHead>Τύπος</TableHead>
              <TableHead>Παρέχει</TableHead>
              <TableHead className="text-center">Προτεραιότητα</TableHead>
              <TableHead className="text-center">Κατάσταση</TableHead>
              <TableHead>Τελευταίο OK</TableHead>
              <TableHead className="hidden md:table-cell">
                Σημειώσεις
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {s.kind}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(s.provides || []).map((p) => (
                      <Badge
                        key={p}
                        variant="outline"
                        className="text-[10px]"
                      >
                        {p}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-center font-mono">
                  {s.priority}
                </TableCell>
                <TableCell className="text-center">
                  {statusBadge(s)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {s.last_ok_at ? timeAgo(s.last_ok_at) : "—"}
                </TableCell>
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                  {s.notes || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Error details */}
      {sources.some((s) => s.last_error) && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Πρόσφατα σφάλματα</h2>
          {sources
            .filter((s) => s.last_error)
            .map((s) => (
              <Card key={s.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{s.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-destructive font-mono">
                    {s.last_error}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {s.last_error_at
                      ? new Date(s.last_error_at).toLocaleString("el")
                      : ""}
                  </p>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
