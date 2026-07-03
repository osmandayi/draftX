/**
 * Username-based auth on top of Supabase (which is email-based) via a
 * deterministic synthetic email. A username `bob` maps to
 * `bob@users.draftx.app`; the user never sees it. Uniqueness comes for free
 * from Supabase's unique auth email. A real email can later be attached from
 * the profile page (see LinkEmailForm), after which the user can sign in with
 * either their username or that email.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/** Lowercase letters, digits and underscore, 3–20 chars. */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

const SYNTHETIC_EMAIL_DOMAIN = "users.draftx.app";

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}

/** Deterministic synthetic email backing a username account. */
export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

/** True when an email is a synthetic (username) address, not a real inbox. */
export function isSyntheticEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`);
}

/**
 * Resolve a sign-in identifier to the email Supabase expects. If it looks like
 * an email (real, or a previously linked one) use it as-is; otherwise treat it
 * as a username and derive the synthetic address.
 */
export function identifierToEmail(identifier: string): string {
  const trimmed = identifier.trim();
  return trimmed.includes("@")
    ? trimmed.toLowerCase()
    : usernameToEmail(trimmed);
}
