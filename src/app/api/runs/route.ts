import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: runs } = await supabase
    .from("runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(50);

  return Response.json({ runs: runs || [] });
}
