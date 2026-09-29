import { createClient, createServiceClient } from "@/lib/supabase/server";
import { spawn } from "child_process";
import path from "path";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  // 1. Auth: check session + admin role
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Μη εξουσιοδοτημένο" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("role, active")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || !profile.active) {
    return Response.json({ error: "Μόνο διαχειριστές" }, { status: 403 });
  }

  // 2. Parse body
  const body = await request.json().catch(() => ({}));
  const kind: string = body.kind === "cron" ? "cron" : "manual";
  const ticker: string | null = body.ticker || null;
  const mock: boolean = body.mock === true;
  const scope = ticker || "all";

  // 3. Rate limits from runs table (last 10 min, last 24h)
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: recentCount } = await service
    .from("runs")
    .select("id", { count: "exact", head: true })
    .eq("requested_by", user.id)
    .gte("started_at", tenMinAgo);

  if ((recentCount ?? 0) >= 1) {
    return Response.json(
      { error: "Πολύ σύντομα. Δοκιμάστε ξανά σε 10 λεπτά." },
      { status: 429 }
    );
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: dailyCount } = await service
    .from("runs")
    .select("id", { count: "exact", head: true })
    .eq("requested_by", user.id)
    .gte("started_at", dayAgo);

  if ((dailyCount ?? 0) >= 10) {
    return Response.json(
      { error: "Ημερήσιο όριο (10 εκτελέσεις). Δοκιμάστε αύριο." },
      { status: 429 }
    );
  }

  // 4. Insert runs row (queued)
  const runId = randomUUID();
  const { error: insertError } = await service.from("runs").insert({
    id: runId,
    kind,
    scope,
    status: "queued",
    trading_date: new Date().toISOString().slice(0, 10),
    requested_by: user.id,
  });

  if (insertError) {
    return Response.json(
      { error: "Αποτυχία δημιουργίας run" },
      { status: 500 }
    );
  }

  // 5. Dispatch based on TRIGGER_MODE
  const triggerMode = process.env.TRIGGER_MODE || "local";

  if (triggerMode === "local") {
    // Spawn Python pipeline as child process
    const pipelineDir = path.resolve(process.cwd(), "pipeline");
    const venvPython = path.join(pipelineDir, ".venv", "bin", "python");

    const args = ["--kind", kind, "--run-id", runId];
    if (ticker) args.push("--ticker", ticker);
    if (mock) args.push("--mock");

    const child = spawn(venvPython, ["-m", "pipeline", ...args], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: "ignore",
      detached: true,
    });

    child.unref();

    return Response.json({ run_id: runId, status: "queued", mode: "local" });
  }

  // GitHub mode: workflow_dispatch
  const ghToken = process.env.GITHUB_DISPATCH_TOKEN;
  const ghRepo = process.env.GITHUB_REPO;
  const ghWorkflow = process.env.GITHUB_WORKFLOW_FILE || "pipeline.yml";

  if (!ghToken || !ghRepo) {
    // Mark run as failed
    await service
      .from("runs")
      .update({ status: "failed" })
      .eq("id", runId);
    return Response.json(
      { error: "GitHub dispatch δεν είναι ρυθμισμένο" },
      { status: 500 }
    );
  }

  const dispatchResp = await fetch(
    `https://api.github.com/repos/${ghRepo}/actions/workflows/${ghWorkflow}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: { kind, ticker: ticker || "", run_id: runId },
      }),
    }
  );

  if (!dispatchResp.ok) {
    await service
      .from("runs")
      .update({ status: "failed" })
      .eq("id", runId);
    return Response.json(
      { error: "GitHub dispatch απέτυχε" },
      { status: 502 }
    );
  }

  return Response.json({ run_id: runId, status: "queued", mode: "github" });
}
