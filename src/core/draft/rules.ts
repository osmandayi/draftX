import { DRAFTABLE_PLAYERS } from "@/lib/constants";
import { captainSlotForTurn, TOTAL_PICKS } from "./schedule";
import type {
  CaptainSlot,
  DraftPlayer,
  DraftState,
  Team,
} from "./types";

/**
 * Pure validation + derivation helpers. The database RPCs enforce the same
 * rules authoritatively; these mirror them for client-side UX (disabling
 * buttons, showing errors) and are covered by unit tests.
 */

export type PickValidation =
  | { ok: true }
  | { ok: false; reason: PickError };

export type PickError =
  | "not-active"
  | "not-your-turn"
  | "player-not-found"
  | "player-taken";

/** Resolve the concrete captain user id for a slot in a draft. */
export function captainIdForSlot(
  draft: Pick<DraftState, "captainA" | "captainB">,
  slot: CaptainSlot,
): string | null {
  return slot === "A" ? draft.captainA : draft.captainB;
}

/** Which slot ("A"/"B") a given captain user id occupies, if any. */
export function slotForCaptainId(
  draft: Pick<DraftState, "captainA" | "captainB">,
  captainId: string,
): CaptainSlot | null {
  if (draft.captainA === captainId) return "A";
  if (draft.captainB === captainId) return "B";
  return null;
}

/** Whether a user id is a member (either captain) of the draft. */
export function isCaptain(
  draft: Pick<DraftState, "captainA" | "captainB">,
  userId: string,
): boolean {
  return draft.captainA === userId || draft.captainB === userId;
}

/**
 * Validate a manual pick attempt against current draft state. Mirrors the
 * server RPC checks (turn ownership + availability).
 */
export function validatePick(
  draft: DraftState,
  captainId: string,
  playerId: string,
): PickValidation {
  if (draft.status !== "active") return { ok: false, reason: "not-active" };

  const expectedSlot = captainSlotForTurn(draft.turnIndex);
  const expectedCaptain = captainIdForSlot(draft, expectedSlot);
  if (expectedCaptain !== captainId) {
    return { ok: false, reason: "not-your-turn" };
  }

  const player = draft.players.find((p) => p.id === playerId);
  if (!player) return { ok: false, reason: "player-not-found" };
  if (player.draftedBy) return { ok: false, reason: "player-taken" };

  return { ok: true };
}

/** Whether the draft has enough players and captains to start. */
export function canStart(
  draft: Pick<DraftState, "status" | "captainA" | "captainB" | "players">,
): boolean {
  const available = draft.players.length;
  return (
    draft.status === "lobby" &&
    !!draft.captainA &&
    !!draft.captainB &&
    available === DRAFTABLE_PLAYERS
  );
}

/** Players still available to be drafted. */
export function availablePlayers(players: DraftPlayer[]): DraftPlayer[] {
  return players.filter((p) => !p.draftedBy);
}

/**
 * The next player the engine auto-picks on timeout / final assignment.
 * Deterministic: earliest-added available player (stable ordering by
 * pickNumber-less insertion is handled by the caller passing sorted input).
 */
export function nextAutoPick(players: DraftPlayer[]): DraftPlayer | null {
  return availablePlayers(players)[0] ?? null;
}

/** Assemble the two teams from drafted player rows + captain ids. */
export function assembleTeams(draft: DraftState): Team[] {
  const teamFor = (captainId: string | null, slot: CaptainSlot): Team => ({
    captainId: captainId ?? "",
    slot,
    playerIds: draft.players
      .filter((p) => p.draftedBy === captainId)
      .sort((a, b) => (a.pickNumber ?? 0) - (b.pickNumber ?? 0))
      .map((p) => p.id),
  });
  return [teamFor(draft.captainA, "A"), teamFor(draft.captainB, "B")];
}

/** Number of picks already made (players with a pick number assigned). */
export function picksMade(players: DraftPlayer[]): number {
  return players.filter((p) => p.pickNumber !== null).length;
}

/** Whether every pick has been made. */
export function isComplete(players: DraftPlayer[]): boolean {
  return picksMade(players) >= TOTAL_PICKS;
}
