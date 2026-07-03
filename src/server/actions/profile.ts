"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../auth";
import { createSupabaseServerClient } from "../supabase/server";
import { type ActionResult, errorMessage, fail, ok } from "./types";

/** Update the current user's display name. */
export async function updateDisplayName(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const displayName = String(formData.get("display_name") ?? "").trim();

  if (displayName.length < 1 || displayName.length > 40) {
    return fail("Display name must be between 1 and 40 characters.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);

  if (error) return fail(errorMessage(error));

  revalidatePath("/profile");
  return ok(undefined);
}
