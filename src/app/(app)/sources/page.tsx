import { verifySession } from "@/lib/auth";
import { SourcesClient } from "./sources-client";

export default async function SourcesPage() {
  const { supabase, profile } = await verifySession();

  const { data: sources } = await supabase
    .from("sources")
    .select("*")
    .order("priority");

  return (
    <SourcesClient
      sources={sources || []}
      isAdmin={profile.role === "admin"}
    />
  );
}
