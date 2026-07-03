"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../auth";
import { createSupabaseServerClient } from "../supabase/server";
import { type ActionResult, errorMessage, fail, ok } from "./types";

/** Add a player to the pool (lobby only, max 12). */
export async function addPlayer(
  draftId: string,
  name: string,
): Promise<ActionResult> {
  await requireUser();
  const trimmed = name.trim();
  if (!trimmed) return fail("Player name is required.");
  if (trimmed.length > 60) return fail("Player name is too long.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("add_player", {
    p_draft_id: draftId,
    p_name: trimmed,
  });
  if (error) return fail(errorMessage(error));

  revalidatePath(`/drafts/${draftId}/room`);
  return ok(undefined);
}

/** Remove a player from the pool (lobby only). */
export async function removePlayer(
  draftId: string,
  playerId: string,
): Promise<ActionResult> {
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("remove_player", {
    p_player_id: playerId,
  });
  if (error) return fail(errorMessage(error));

  revalidatePath(`/drafts/${draftId}/room`);
  return ok(undefined);
}
