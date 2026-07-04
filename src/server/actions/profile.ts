"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../auth";
import { createSupabaseServerClient } from "../supabase/server";
import { type ActionResult, errorMessage, fail, ok } from "./types";
import { RATE_LIMIT_MESSAGE, checkLimit } from "../rate-limit";

/** Update the current user's display name. */
export async function updateDisplayName(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const displayName = String(formData.get("display_name") ?? "").trim();

  if (displayName.length < 1 || displayName.length > 40) {
    return fail("Display name must be between 1 and 40 characters.");
  }

  const gate = await checkLimit(user.id, "profile");
  if (!gate.ok) return fail(RATE_LIMIT_MESSAGE);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);

  if (error) return fail(errorMessage(error));

  revalidatePath("/profile");
  return ok(undefined);
}
