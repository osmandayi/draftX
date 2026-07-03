/**
 * Domain types for the draft engine. These are intentionally decoupled from
 * the database row shapes so the pure logic in `schedule.ts` / `rules.ts` can
 * be tested without any Supabase dependency.
 */

export type CaptainSlot = "A" | "B";

export type DraftStatus = "lobby" | "active" | "completed";

export interface DraftPlayer {
  id: string;
  name: string;
  /** Captain user id who drafted this player, or null if still available. */
  draftedBy: string | null;
  /** 1-based pick number, or null if not yet drafted. */
  pickNumber: number | null;
}

export interface DraftState {
  id: string;
  status: DraftStatus;
  captainA: string | null;
  captainB: string | null;
  /** Captain user id currently on the clock (null unless active). */
  currentCaptain: string | null;
  /** 0-based index into the pick schedule. */
  turnIndex: number;
  /** ISO timestamp when the current turn expires, or null. */
  turnDeadline: string | null;
  players: DraftPlayer[];
}

export interface PickRecord {
  playerId: string;
  captainId: string;
  pickNumber: number;
  wasAuto: boolean;
}

export interface Team {
  captainId: string;
  slot: CaptainSlot;
  playerIds: string[];
}
