import { createClient } from "@/lib/supabase/server";
import { RunsClient } from "./runs-client";

export default async function RunsPage() {
  const supabase = await createClient();

  const { data: runs } = await supabase
    .from("runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(50);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user!.id)
    .single();

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
      isAdmin={profile?.role === "admin"}
      monthlyCosts={monthlyCosts}
    />
  );
}
