import { describe, expect, it } from "vitest";
import {
  captainSlotForTurn,
  isDraftComplete,
  isFinalAutoTurn,
  picksPerCaptain,
  TOTAL_PICKS,
} from "./schedule";

describe("draft schedule", () => {
  it("has 12 total picks", () => {
    expect(TOTAL_PICKS).toBe(12);
  });

  it("follows the A,B,B,A,A,B,B,A,A,B,B order for explicit picks", () => {
    const slots = Array.from({ length: 11 }, (_, i) => captainSlotForTurn(i));
    expect(slots).toEqual([
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
    ]);
  });

  it("auto-assigns the final pick (index 11) to captain A", () => {
    expect(isFinalAutoTurn(11)).toBe(true);
    expect(captainSlotForTurn(11)).toBe("A");
  });

  it("throws for out-of-range turn indices", () => {
    expect(() => captainSlotForTurn(-1)).toThrow();
    expect(() => captainSlotForTurn(12)).toThrow();
  });

  it("gives each captain 6 drafted players", () => {
    expect(picksPerCaptain()).toEqual({ A: 6, B: 6 });
  });

  it("detects completion at 12 picks", () => {
    expect(isDraftComplete(11)).toBe(false);
    expect(isDraftComplete(12)).toBe(true);
  });
});
