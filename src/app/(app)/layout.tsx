import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";
import { signOut } from "../actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav
        email={profile.email}
        role={profile.role}
        signOutAction={signOut}
      />
      <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
        {children}
      </main>
      <footer className="border-t px-4 py-3 text-center text-xs text-muted-foreground">
        Δεν αποτελεί επενδυτική συμβουλή.
      </footer>
    </div>
  );
}
