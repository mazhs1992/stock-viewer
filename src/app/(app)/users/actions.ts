"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Not admin");
  return user;
}

export async function inviteUser(formData: FormData) {
  const admin = await requireAdmin();
  const email = formData.get("email") as string;
  const role = formData.get("role") as string;

  const service = createServiceClient();
  const { error } = await service
    .from("invites")
    .insert({ email, role, invited_by: admin.id });

  if (error) throw new Error("Αποτυχία πρόσκλησης: " + error.message);
  revalidatePath("/users");
}

export async function revokeInvite(formData: FormData) {
  await requireAdmin();
  const email = formData.get("email") as string;

  const service = createServiceClient();
  const { error } = await service
    .from("invites")
    .delete()
    .eq("email", email)
    .is("accepted_at", null);

  if (error) throw new Error("Αποτυχία ανάκλησης: " + error.message);
  revalidatePath("/users");
}

export async function changeRole(formData: FormData) {
  await requireAdmin();
  const userId = formData.get("user_id") as string;
  const role = formData.get("role") as string;

  const service = createServiceClient();
  const { error } = await service
    .from("profiles")
    .update({ role })
    .eq("user_id", userId);

  if (error) throw new Error("Αποτυχία αλλαγής ρόλου: " + error.message);
  revalidatePath("/users");
}

export async function toggleActive(formData: FormData) {
  await requireAdmin();
  const userId = formData.get("user_id") as string;
  const active = formData.get("active") === "true";

  const service = createServiceClient();
  const { error } = await service
    .from("profiles")
    .update({ active: !active })
    .eq("user_id", userId);

  if (error) throw new Error("Αποτυχία αλλαγής κατάστασης: " + error.message);
  revalidatePath("/users");
}

export async function sendPasswordReset(formData: FormData) {
  await requireAdmin();
  const email = formData.get("email") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "http://localhost:3000/auth/reset",
  });

  if (error) throw new Error("Αποτυχία αποστολής: " + error.message);
}
