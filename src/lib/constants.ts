/**
 * Global draft constants. These are the single source of truth on the client;
 * the database enforces the same values inside the `make_pick` RPC.
 */

/** Total squad size including both captains. */
export const TOTAL_PLAYERS = 14;

/** Number of captains. */
export const CAPTAIN_COUNT = 2;

/** Players that must be added (and then drafted) besides the captains. */
export const DRAFTABLE_PLAYERS = TOTAL_PLAYERS - CAPTAIN_COUNT; // 12

/** Seconds allowed per turn before the engine auto-picks. */
export const TURN_SECONDS = 120;

/**
 * Explicit pick schedule. Each entry is the captain on the clock for that
 * pick (0-based turn index). After these 11 picks exactly one player remains
 * and is auto-assigned to Captain A.
 *
 *   A picks 1, B picks 2, A picks 2, B picks 2, A picks 2, B picks 2
 *
 * Result: Captain A = captain + 6, Captain B = captain + 6 (7 each).
 */
export const PICK_SCHEDULE = [
  "A",
  "B",
  "B",
  "A",
  "A",
  "B",
  "B",
  "A",
  "A",
  "B",
  "B",
] as const;

/** Number of explicit (manual) picks before the final auto-assign. */
export const EXPLICIT_PICKS = PICK_SCHEDULE.length; // 11

export const DRAFT_STATUS = {
  Lobby: "lobby",
  Active: "active",
  Completed: "completed",
} as const;
