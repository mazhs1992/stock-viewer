"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function signInWithEmail(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Check if it's our invite-only rejection
    const msg = error.message.includes("πρόσκληση")
      ? error.message
      : "Λάθος email ή κωδικός.";
    redirect(`/login?error=${encodeURIComponent(msg)}`);
  }

  redirect("/");
}

export async function signUpWithEmail(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    const msg = error.message.includes("πρόσκληση")
      ? error.message
      : "Η εγγραφή απέτυχε: " + error.message;
    redirect(`/login?error=${encodeURIComponent(msg)}`);
  }

  redirect(
    `/login?message=${encodeURIComponent("Ελέγξτε το email σας για επιβεβαίωση.")}`
  );
}

export async function resetPassword(formData: FormData) {
  const email = formData.get("email") as string;
  const origin = (await headers()).get("origin") || "http://localhost:3000";

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/reset`,
  });

  if (error) {
    redirect(
      `/login?error=${encodeURIComponent("Αποτυχία αποστολής email: " + error.message)}`
    );
  }

  redirect(
    `/login?message=${encodeURIComponent("Ελέγξτε το email σας για τον σύνδεσμο επαναφοράς κωδικού.")}`
  );
}

export async function signInWithGoogle() {
  const origin = (await headers()).get("origin") || "http://localhost:3000";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect(
      `/login?error=${encodeURIComponent("Η σύνδεση με Google απέτυχε.")}`
    );
  }

  redirect(data.url);
}
