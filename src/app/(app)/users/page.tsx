import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const { supabase, user, profile } = await verifySession();

  if (profile.role !== "admin") redirect("/");

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
