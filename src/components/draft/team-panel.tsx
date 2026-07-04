"use client";

import { Star, Zap } from "lucide-react";
import type { DraftState } from "@/core/draft/types";
import { cn } from "@/lib/utils";
import { CaptainTag } from "./captain-tag";
import { CAPTAIN_COLORS } from "./captain-colors";
import type { CaptainMap } from "./types";

const SLOTS_PER_TEAM = 6; // drafted players besides the captain

export function TeamPanel({
  draft,
  slot,
  captains,
  onClock,
}: {
  draft: DraftState;
  slot: "A" | "B";
  captains: CaptainMap;
  onClock: boolean;
}) {
  const captainId = slot === "A" ? draft.captainA : draft.captainB;
  const color = CAPTAIN_COLORS[slot];
  const roster = draft.players
    .filter((p) => p.draftedBy && p.draftedBy === captainId)
    .sort((a, b) => (a.pickNumber ?? 0) - (b.pickNumber ?? 0));

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3 transition-colors",
        onClock
          ? cn(color.border, "ring-1", color.panelRing)
          : "border-border/60",
      )}
    >
      <div className="flex items-center justify-between">
        <CaptainTag
          captain={captainId ? captains[captainId] : null}
          slot={slot}
        />
        {onClock ? (
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              color.badge,
            )}
          >
            <Zap className="size-3" />
            On the clock
          </span>
        ) : null}
      </div>

      <ul className="mt-3 space-y-1.5">
        <li className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm">
          <Star className={cn("size-3.5", color.text)} />
          <span className="font-medium">
            {captainId ? captains[captainId]?.name : "Captain"}
          </span>
          <span className="ml-auto text-[11px] text-muted-foreground">C</span>
        </li>
        {Array.from({ length: SLOTS_PER_TEAM }).map((_, i) => {
          const player = roster[i];
          return (
            <li
              key={player?.id ?? `empty-${i}`}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm",
                player
                  ? "bg-card ring-1 ring-inset ring-border/60"
                  : "border border-dashed border-border/60 text-muted-foreground",
              )}
            >
              {player ? (
                <>
                  <span className="truncate">{player.name}</span>
                  <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                    #{player.pickNumber}
                  </span>
                </>
              ) : (
                <span className="text-xs">Empty slot</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
