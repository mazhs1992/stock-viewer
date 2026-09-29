import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { signOut } from "./actions";

export default async function Home() {
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

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Stock Viewer</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {profile?.email} ({profile?.role})
          </span>
          <ThemeToggle />
          <form action={signOut}>
            <Button variant="ghost" size="sm">
              Αποσύνδεση
            </Button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">
          Watchlist — σύντομα διαθέσιμο
        </p>
      </main>
      <footer className="border-t px-4 py-2 text-center text-xs text-muted-foreground">
        Δεν αποτελεί επενδυτική συμβουλή.
      </footer>
    </div>
  );
}
