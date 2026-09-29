import { verifySession } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";
import { signOut } from "../actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { profile } = await verifySession();

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
