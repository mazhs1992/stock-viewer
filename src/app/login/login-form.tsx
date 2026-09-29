"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export function LoginForm() {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message.includes("πρόσκληση") ? error.message : "Λάθος email ή κωδικός.");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function handleRegister() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message.includes("πρόσκληση") ? error.message : "Η εγγραφή απέτυχε: " + error.message);
      setLoading(false);
      return;
    }
    setMessage("Ελέγξτε το email σας για επιβεβαίωση.");
    setLoading(false);
  }

  async function handleReset() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    if (error) {
      setError("Αποτυχία αποστολής email: " + error.message);
      setLoading(false);
      return;
    }
    setMessage("Ελέγξτε το email σας για τον σύνδεσμο επαναφοράς κωδικού.");
    setLoading(false);
  }

  async function handleGoogle() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error || !data.url) {
      setError("Η σύνδεση με Google απέτυχε.");
      return;
    }
    window.location.href = data.url;
  }

  if (mode === "reset") {
    return (
      <div className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm">
            {message}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button onClick={handleReset} disabled={loading} className="w-full">
          {loading ? "..." : "Αποστολή συνδέσμου"}
        </Button>
        <button
          type="button"
          onClick={() => { setMode("login"); setError(""); setMessage(""); }}
          className="w-full text-center text-sm text-muted-foreground hover:underline"
        >
          Πίσω στη σύνδεση
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <Button onClick={handleGoogle} variant="outline" className="w-full">
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Σύνδεση με Google
      </Button>

      <div className="relative">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
          ή
        </span>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Κωδικός</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (mode === "login" ? handleLogin() : handleRegister())}
          />
        </div>
        <Button
          onClick={mode === "login" ? handleLogin : handleRegister}
          disabled={loading}
          className="w-full"
        >
          {loading ? "..." : mode === "login" ? "Σύνδεση" : "Εγγραφή"}
        </Button>
      </div>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setMessage(""); }}
          className="text-muted-foreground hover:underline"
        >
          {mode === "login" ? "Δημιουργία λογαριασμού" : "Έχω ήδη λογαριασμό"}
        </button>
        <button
          type="button"
          onClick={() => { setMode("reset"); setError(""); setMessage(""); }}
          className="text-muted-foreground hover:underline"
        >
          Ξέχασα τον κωδικό
        </button>
      </div>
    </div>
  );
}
