"use client";

import { useCallback } from "react";
import { resolveTimeout } from "@/server/actions/picks";
import { slotForCaptainId } from "@/core/draft/rules";
import { TOTAL_PICKS } from "@/core/draft/schedule";
import type { DraftState } from "@/core/draft/types";
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

  // Both clients fire on expiry; resolve_timeout is an idempotent no-op if the
  // turn was already advanced, so this also covers a disconnected captain.
  const handleExpire = useCallback(() => {
    void resolveTimeout(draft.id);
  }, [draft.id]);

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4">
        <TurnTimer deadline={draft.turnDeadline} onExpire={handleExpire} />
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Pick {pickNumber} of {TOTAL_PICKS}
          </p>
          <p className="truncate text-lg font-semibold">
            {isMyTurn ? (
              <span className="text-primary">Your pick</span>
            ) : (
              <>
                {onClockName}
                <span className="text-muted-foreground"> is picking…</span>
              </>
            )}
          </p>
          {onClockSlot ? (
            <p className="text-xs text-muted-foreground">
              Captain {onClockSlot} on the clock
            </p>
          ) : null}
        </div>
      </div>

      <PickPool draft={draft} isMyTurn={isMyTurn} />

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
