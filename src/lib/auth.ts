import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Verify the current user session and return user + profile.
 * Memoized per-request via React cache() — safe to call from
 * both layout and page without duplicate DB calls.
 * Redirects to /login if not authenticated or no profile.
 */
export const verifySession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, email, role, active")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/login");

  return { user, profile, supabase };
});
