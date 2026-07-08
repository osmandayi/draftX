/** A saved player name owned by the current user. */
export interface SavedPlayer {
  id: string;
  name: string;
  created_at: string;
}

/** Canonical form for case- and whitespace-insensitive matching. */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** True if `name` already appears in `list` (case/whitespace-insensitive). */
export function isNameInList(name: string, list: { name: string }[]): boolean {
  const key = normalizeName(name);
  return list.some((entry) => normalizeName(entry.name) === key);
}

/**
 * Saved names matching `query` for the autocomplete, excluding names already
 * in the pool. Empty query returns [] (the browse panel handles "show all").
 */
export function filterSuggestions(
  query: string,
  saved: SavedPlayer[],
  poolNames: string[],
): SavedPlayer[] {
  const q = normalizeName(query);
  if (!q) return [];
  const pool = new Set(poolNames.map(normalizeName));
  return saved.filter(
    (entry) =>
      normalizeName(entry.name).startsWith(q) &&
      !pool.has(normalizeName(entry.name)),
  );
}
