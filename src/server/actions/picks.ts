"use server";

import { requireUser } from "../auth";
import { createSupabaseServerClient } from "../supabase/server";
import { type ActionResult, errorMessage, fail, ok } from "./types";
import { RATE_LIMIT_MESSAGE, checkLimit } from "../rate-limit";

/**
 * Draft a player. The database RPC re-validates turn ownership + availability
 * atomically, so this is safe against races and stale clients.
 */
export async function makePick(
  draftId: string,
  playerId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const gate = await checkLimit(user.id, "pick");
  if (!gate.ok) return fail(RATE_LIMIT_MESSAGE);
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("make_pick", {
    p_draft_id: draftId,
    p_player_id: playerId,
  });
  if (error) return fail(errorMessage(error));
  return ok(undefined);
}

/**
 * Resolve an expired turn (auto-pick). The RPC re-checks the deadline, so
 * calling it early or from multiple clients is a harmless no-op.
 */
export async function resolveTimeout(draftId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("resolve_timeout", {
    p_draft_id: draftId,
  });
  if (error) return fail(errorMessage(error));
  return ok(undefined);
}
