"use client";

import { useCallback } from "react";
import { resolveTimeout } from "@/server/actions/picks";
import { slotForCaptainId } from "@/core/draft/rules";
import { TOTAL_PICKS } from "@/core/draft/schedule";
import type { DraftState } from "@/core/draft/types";
import { cn } from "@/lib/utils";
import { CAPTAIN_COLORS } from "./captain-colors";
import { PickPool } from "./pick-pool";
import { TeamPanel } from "./team-panel";
import { TurnTimer } from "./turn-timer";
import type { CaptainMap } from "./types";

export function DraftBoard({
  draft,
  currentUserId,
  captains,
}: {
  draft: DraftState;
  currentUserId: string;
  captains: CaptainMap;
}) {
  const currentCaptainId = draft.currentCaptain;
  const isMyTurn = currentCaptainId === currentUserId;
  const onClockSlot = currentCaptainId
    ? slotForCaptainId(draft, currentCaptainId)
    : null;
  const onClockName = currentCaptainId
    ? (captains[currentCaptainId]?.name ?? "Captain")
    : "Captain";
  const pickNumber = Math.min(draft.turnIndex + 1, TOTAL_PICKS);
  const onClockColor = onClockSlot ? CAPTAIN_COLORS[onClockSlot] : null;

  // Both clients fire on expiry; resolve_timeout is an idempotent no-op if the
  // turn was already advanced, so this also covers a disconnected captain.
  const handleExpire = useCallback(() => {
    void resolveTimeout(draft.id);
  }, [draft.id]);

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4">
        <TurnTimer
          deadline={draft.turnDeadline}
          totalSeconds={draft.turnSeconds}
          slot={onClockSlot}
          onExpire={handleExpire}
        />
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Pick {pickNumber} of {TOTAL_PICKS}
          </p>
          <p className="truncate text-lg font-semibold">
            {isMyTurn ? (
              <span className={cn(onClockColor?.text)}>Your pick</span>
            ) : (
              <>
                <span className={cn(onClockColor?.text)}>{onClockName}</span>
                <span className="text-muted-foreground"> is picking…</span>
              </>
            )}
          </p>
          {onClockSlot ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  onClockColor?.dot,
                )}
              />
              Captain {onClockSlot} on the clock
            </p>
          ) : null}
        </div>
      </div>

      <PickPool draft={draft} isMyTurn={isMyTurn} slot={onClockSlot} />

      <div className="grid gap-3 sm:grid-cols-2">
        <TeamPanel
          draft={draft}
          slot="A"
          captains={captains}
          onClock={onClockSlot === "A"}
        />
        <TeamPanel
          draft={draft}
          slot="B"
          captains={captains}
          onClock={onClockSlot === "B"}
        />
      </div>
    </div>
  );
}
