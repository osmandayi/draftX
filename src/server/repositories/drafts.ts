import "server-only";
import type { DraftState } from "@/core/draft/types";
import type { DraftRow, PlayerRow } from "@/lib/database.types";
import { createSupabaseServerClient } from "../supabase/server";

/** Map raw draft + player rows into the pure domain DraftState. */
export function toDraftState(draft: DraftRow, players: PlayerRow[]): DraftState {
  return {
    id: draft.id,
    status: draft.status,
    captainA: draft.captain_a,
    captainB: draft.captain_b,
    currentCaptain: draft.current_captain,
    turnIndex: draft.turn_index,
    turnDeadline: draft.turn_deadline,
    players: players
      .slice()
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
      .map((p) => ({
        id: p.id,
        name: p.name,
        draftedBy: p.drafted_by,
        pickNumber: p.pick_number,
      })),
  };
}

/** Full draft row + its players, or null if not accessible. */
export async function getDraftWithPlayers(draftId: string) {
  const supabase = await createSupabaseServerClient();

  const [{ data: draft }, { data: players }] = await Promise.all([
    supabase.from("drafts").select("*").eq("id", draftId).maybeSingle(),
    supabase
      .from("players")
      .select("*")
      .eq("draft_id", draftId)
      .order("created_at", { ascending: true }),
  ]);

  if (!draft) return null;
  return { draft, players: players ?? [] };
}

/** Drafts the current user participates in, newest first. */
export async function listUserDrafts(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("drafts")
    .select("*")
    .or(
      `creator_id.eq.${userId},captain_a.eq.${userId},captain_b.eq.${userId}`,
    )
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Invite preview for the join page (works for non-members via RPC). */
export async function getInvite(token: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("get_invite", { p_token: token });
  return data?.[0] ?? null;
}
