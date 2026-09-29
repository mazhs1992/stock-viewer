"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function ResetForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirm = formData.get("confirm") as string;

    if (password !== confirm) {
      setError("Οι κωδικοί δεν ταιριάζουν.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError("Αποτυχία αλλαγής κωδικού: " + updateError.message);
      setLoading(false);
      return;
    }

    router.push("/");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="password">Νέος κωδικός</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Επιβεβαίωση κωδικού</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={6}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Αποθήκευση..." : "Αλλαγή κωδικού"}
      </Button>
    </form>
  );
}
