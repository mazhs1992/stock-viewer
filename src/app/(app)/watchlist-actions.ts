"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function addTicker(ticker: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Μη εξουσιοδοτημένο" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!profile || !["admin", "member"].includes(profile.role)) {
    return { error: "Δεν έχετε δικαίωμα" };
  }

  // Check if ticker already exists
  const service = createServiceClient();
  const { data: existing } = await service
    .from("assets")
    .select("ticker")
    .eq("ticker", ticker)
    .single();

  if (existing) {
    // Reactivate if inactive
    await service
      .from("assets")
      .update({ active: true, updated_by: user.id })
      .eq("ticker", ticker);
    revalidatePath("/");
    return {};
  }

  // Insert new asset
  const { error } = await service.from("assets").insert({
    ticker,
    name: ticker,
    sector: "",
    active: true,
    added_by: user.id,
    updated_by: user.id,
  });

  if (error) return { error: `Αποτυχία: ${error.message}` };

  revalidatePath("/");
  return {};
}

export async function removeTicker(ticker: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const service = createServiceClient();
  await service
    .from("assets")
    .update({ active: false, updated_by: user.id })
    .eq("ticker", ticker);

  revalidatePath("/");
}
