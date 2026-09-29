import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  // Step 1: getUser (same as layout)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ step: "getUser", failed: true, error: userError?.message });
  }

  // Step 2: query profile (same as layout)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return Response.json({
      step: "profile",
      failed: true,
      userId: user.id,
      error: profileError?.message,
      code: profileError?.code,
    });
  }

  return Response.json({
    step: "all_ok",
    user: { id: user.id, email: user.email },
    profile,
  });
}
