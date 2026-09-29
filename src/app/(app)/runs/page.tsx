import { verifySession } from "@/lib/auth";
import { RunsClient } from "./runs-client";

export default async function RunsPage() {
  const { supabase, profile } = await verifySession();

  const { data: runs } = await supabase
    .from("runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(50);

  // Monthly cost totals
  const allRuns = runs || [];
  const monthlyCosts: Record<string, number> = {};
  for (const r of allRuns) {
    if (!r.started_at || !r.cost_usd) continue;
    const month = r.started_at.slice(0, 7); // YYYY-MM
    monthlyCosts[month] = (monthlyCosts[month] || 0) + r.cost_usd;
  }

  return (
    <RunsClient
      runs={allRuns}
      isAdmin={profile.role === "admin"}
      monthlyCosts={monthlyCosts}
    />
  );
}
