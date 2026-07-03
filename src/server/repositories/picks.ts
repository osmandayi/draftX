import "server-only";
import { createSupabaseServerClient } from "../supabase/server";

/** Ordered pick log for a completed/active draft. */
export async function listPicks(draftId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("picks")
    .select("*")
    .eq("draft_id", draftId)
    .order("pick_number", { ascending: true });
  return data ?? [];
}
