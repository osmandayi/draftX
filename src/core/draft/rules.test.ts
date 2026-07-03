import { describe, expect, it } from "vitest";
import {
  assembleTeams,
  availablePlayers,
  canStart,
  isComplete,
  nextAutoPick,
  slotForCaptainId,
  validatePick,
} from "./rules";
import type { DraftPlayer, DraftState } from "./types";

const A = "captain-a";
const B = "captain-b";

function makePlayers(count: number): DraftPlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    draftedBy: null,
    pickNumber: null,
  }));
}

function baseDraft(overrides: Partial<DraftState> = {}): DraftState {
  return {
    id: "d1",
    status: "active",
    captainA: A,
    captainB: B,
    currentCaptain: A,
    turnIndex: 0,
    turnDeadline: null,
    players: makePlayers(12),
    ...overrides,
  };
}

describe("validatePick", () => {
  it("accepts a valid pick from the captain on the clock", () => {
    const draft = baseDraft(); // turn 0 => captain A
    expect(validatePick(draft, A, "p1")).toEqual({ ok: true });
  });

  it("rejects when the draft is not active", () => {
    const draft = baseDraft({ status: "lobby" });
    expect(validatePick(draft, A, "p1")).toEqual({
      ok: false,
      reason: "not-active",
    });
  });

  it("rejects when it is not the caller's turn", () => {
    const draft = baseDraft(); // turn 0 => A
    expect(validatePick(draft, B, "p1")).toEqual({
      ok: false,
      reason: "not-your-turn",
    });
  });

  it("rejects an unknown player", () => {
    const draft = baseDraft();
    expect(validatePick(draft, A, "nope")).toEqual({
      ok: false,
      reason: "player-not-found",
    });
  });

  it("rejects an already drafted player", () => {
    const players = makePlayers(12);
    players[0] = { ...players[0], draftedBy: B, pickNumber: 1 };
    const draft = baseDraft({ players, turnIndex: 1 }); // turn 1 => B
    expect(validatePick(draft, B, "p1")).toEqual({
      ok: false,
      reason: "player-taken",
    });
  });
});

describe("slotForCaptainId", () => {
  it("maps captain ids to slots", () => {
    const draft = baseDraft();
    expect(slotForCaptainId(draft, A)).toBe("A");
    expect(slotForCaptainId(draft, B)).toBe("B");
    expect(slotForCaptainId(draft, "x")).toBeNull();
  });
});

describe("canStart", () => {
  it("requires two captains and exactly 12 players in lobby", () => {
    expect(canStart(baseDraft({ status: "lobby" }))).toBe(true);
    expect(
      canStart(baseDraft({ status: "lobby", players: makePlayers(11) })),
    ).toBe(false);
    expect(canStart(baseDraft({ status: "lobby", captainB: null }))).toBe(
      false,
    );
    expect(canStart(baseDraft({ status: "active" }))).toBe(false);
  });
});

describe("availablePlayers / nextAutoPick", () => {
  it("filters out drafted players and picks the earliest available", () => {
    const players = makePlayers(3);
    players[0] = { ...players[0], draftedBy: A, pickNumber: 1 };
    expect(availablePlayers(players).map((p) => p.id)).toEqual(["p2", "p3"]);
    expect(nextAutoPick(players)?.id).toBe("p2");
  });

  it("returns null when nothing is available", () => {
    const players = makePlayers(1).map((p) => ({
      ...p,
      draftedBy: A,
      pickNumber: 1,
    }));
    expect(nextAutoPick(players)).toBeNull();
  });
});

describe("assembleTeams / isComplete", () => {
  it("groups players by captain ordered by pick number", () => {
    const players = makePlayers(12).map((p, i) => ({
      ...p,
      draftedBy: i % 2 === 0 ? A : B,
      pickNumber: i + 1,
    }));
    const draft = baseDraft({ status: "completed", players });
    const teams = assembleTeams(draft);
    const teamA = teams.find((t) => t.slot === "A")!;
    expect(teamA.playerIds).toEqual(["p1", "p3", "p5", "p7", "p9", "p11"]);
    expect(isComplete(players)).toBe(true);
  });
});
