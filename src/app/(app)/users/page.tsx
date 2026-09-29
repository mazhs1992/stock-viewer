import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, email, role, active")
    .order("email");

  const { data: invites } = await supabase
    .from("invites")
    .select("email, role, created_at, accepted_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Διαχείριση χρηστών</h1>
      <UsersClient
        profiles={profiles ?? []}
        invites={invites ?? []}
        currentUserId={user.id}
      />
    </div>
  );
}
