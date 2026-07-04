/** Uniform result shape returned by Server Actions to client components. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

/**
 * Build a failure result. `code` is an optional machine-readable identifier
 * (e.g. a join_draft outcome) so clients can branch on it instead of parsing
 * the localized `error` message.
 */
export function fail(error: string, code?: string): ActionResult<never> {
  return { ok: false, error, code };
}

/** Extract a human-readable message from a thrown Supabase/Postgres error. */
export function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Something went wrong. Please try again.";
}
