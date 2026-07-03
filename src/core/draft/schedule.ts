import { EXPLICIT_PICKS, PICK_SCHEDULE } from "@/lib/constants";
import type { CaptainSlot } from "./types";

/**
 * Pure helpers describing the fixed 12-player draft order. The database
 * mirrors this schedule inside the `make_pick` RPC; keep the two in sync.
 */

/** Total number of picks (explicit + the final auto-assigned player). */
export const TOTAL_PICKS = EXPLICIT_PICKS + 1; // 12

/**
 * Captain slot on the clock for a given 0-based turn index. Returns "A" for
 * the final auto-assigned pick as well (index === EXPLICIT_PICKS).
 */
export function captainSlotForTurn(turnIndex: number): CaptainSlot {
  if (turnIndex < 0 || turnIndex > EXPLICIT_PICKS) {
    throw new RangeError(`turnIndex out of range: ${turnIndex}`);
  }
  if (turnIndex === EXPLICIT_PICKS) return "A"; // final auto pick
  return PICK_SCHEDULE[turnIndex];
}

/** Whether the given 0-based turn index is the final, auto-assigned pick. */
export function isFinalAutoTurn(turnIndex: number): boolean {
  return turnIndex === EXPLICIT_PICKS;
}

/** Whether the draft is complete after this many picks have been made. */
export function isDraftComplete(picksMade: number): boolean {
  return picksMade >= TOTAL_PICKS;
}

/**
 * How many players each captain slot ends up drafting (excluding themselves).
 * Used for validation and UI progress. { A: 6, B: 6 }.
 */
export function picksPerCaptain(): Record<CaptainSlot, number> {
  const counts: Record<CaptainSlot, number> = { A: 0, B: 0 };
  for (let i = 0; i < TOTAL_PICKS; i++) {
    counts[captainSlotForTurn(i)] += 1;
  }
  return counts;
}
