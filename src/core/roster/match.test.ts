import { describe, expect, it } from "vitest";
import {
  filterSuggestions,
  isNameInList,
  normalizeName,
  type SavedPlayer,
} from "./match";

const saved: SavedPlayer[] = [
  { id: "1", name: "Ahmet", created_at: "2026-01-01T00:00:00Z" },
  { id: "2", name: "Mehmet Yılmaz", created_at: "2026-01-02T00:00:00Z" },
  { id: "3", name: "can", created_at: "2026-01-03T00:00:00Z" },
];

describe("normalizeName", () => {
  it("trims and lowercases", () => {
    expect(normalizeName("  AHmet ")).toBe("ahmet");
  });
});

describe("isNameInList", () => {
  it("matches case- and whitespace-insensitively", () => {
    expect(isNameInList(" ahmet ", saved)).toBe(true);
    expect(isNameInList("CAN", saved)).toBe(true);
  });
  it("returns false for a new name", () => {
    expect(isNameInList("Zeynep", saved)).toBe(false);
  });
});

describe("filterSuggestions", () => {
  it("returns [] for an empty query", () => {
    expect(filterSuggestions("   ", saved, [])).toEqual([]);
  });
  it("matches by prefix, case-insensitively", () => {
    expect(filterSuggestions("me", saved, []).map((s) => s.id)).toEqual(["2"]);
  });
  it("excludes names already in the pool", () => {
    expect(filterSuggestions("ah", saved, ["ahmet"]).map((s) => s.id)).toEqual(
      [],
    );
  });
});
