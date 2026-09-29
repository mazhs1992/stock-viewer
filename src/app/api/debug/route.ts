import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return Response.json({
    cookieCount: allCookies.length,
    cookieNames: allCookies.map((c) => c.name),
    user: user ? { id: user.id, email: user.email } : null,
    error: error?.message || null,
    envCheck: {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      urlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30),
      anonPrefix: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 10),
    },
  });
}
