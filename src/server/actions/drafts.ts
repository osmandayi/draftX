"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "../auth";
import { createSupabaseServerClient } from "../supabase/server";
import { type ActionResult, errorMessage, fail, ok } from "./types";

/** Create a new draft; the creator becomes Captain A. Redirects to the room. */
export async function createDraft(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();

  if (name.length < 1 || name.length > 80) {
    return fail("Draft name must be between 1 and 80 characters.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("drafts")
    .insert({ name, creator_id: user.id, captain_a: user.id })
    .select("id")
    .single();

  if (error || !data) return fail(errorMessage(error));

  revalidatePath("/dashboard");
  redirect(`/drafts/${data.id}/room`);
}

/** Join a draft as Captain B using an invite token. Redirects to the room. */
export async function joinDraft(token: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("join_draft", { p_token: token });
  if (error || !data) return fail(errorMessage(error));

  revalidatePath("/dashboard");
  redirect(`/drafts/${data}/room`);
}

/** Start the draft (creator only). */
export async function startDraft(draftId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("start_draft", { p_draft_id: draftId });
  if (error) return fail(errorMessage(error));

  revalidatePath(`/drafts/${draftId}/room`);
  return ok(undefined);
}
