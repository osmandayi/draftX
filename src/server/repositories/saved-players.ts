import "server-only";
import type { SavedPlayer } from "@/core/roster/match";
import { createSupabaseServerClient } from "../supabase/server";

/**
 * The current user's saved player names, oldest first. RLS scopes the rows to
 * auth.uid(), so no explicit user filter is needed here.
 */
export async function listSavedPlayers(): Promise<SavedPlayer[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("saved_players")
    .select("id, name, created_at")
    .order("created_at", { ascending: true });
  return data ?? [];
}
