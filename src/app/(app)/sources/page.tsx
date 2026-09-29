import { createClient } from "@/lib/supabase/server";
import { SourcesClient } from "./sources-client";

export default async function SourcesPage() {
  const supabase = await createClient();

  const { data: sources } = await supabase
    .from("sources")
    .select("*")
    .order("priority");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user!.id)
    .single();

  return (
    <SourcesClient
      sources={sources || []}
      isAdmin={profile?.role === "admin"}
    />
  );
}
