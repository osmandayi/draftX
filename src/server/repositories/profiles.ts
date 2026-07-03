import "server-only";
import type { ProfileRow } from "@/lib/database.types";
import { createSupabaseServerClient } from "../supabase/server";

/** Load a single profile by user id. */
export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

/** Load several profiles keyed by id (for showing captain names). */
export async function getProfilesByIds(
  ids: string[],
): Promise<Record<string, ProfileRow>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .in("id", unique);

  return Object.fromEntries((data ?? []).map((p) => [p.id, p]));
}
