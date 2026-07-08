"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../auth";
import { createSupabaseServerClient } from "../supabase/server";
import { type ActionResult, errorMessage, fail, ok } from "./types";
import { RATE_LIMIT_MESSAGE, checkLimit } from "../rate-limit";

/** Add a name to the current user's personal roster (deduped server-side). */
export async function addSavedPlayer(name: string): Promise<ActionResult> {
  const user = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) return fail("Player name is required.");
  if (trimmed.length > 60) return fail("Player name is too long.");

  const gate = await checkLimit(user.id, "pool");
  if (!gate.ok) return fail(RATE_LIMIT_MESSAGE);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("add_saved_player", { p_name: trimmed });
  if (error) return fail(errorMessage(error));

  revalidatePath("/players");
  return ok(undefined);
}

/** Remove one saved player from the current user's roster. */
export async function removeSavedPlayer(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const gate = await checkLimit(user.id, "pool");
  if (!gate.ok) return fail(RATE_LIMIT_MESSAGE);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("remove_saved_player", { p_id: id });
  if (error) return fail(errorMessage(error));

  revalidatePath("/players");
  return ok(undefined);
}
