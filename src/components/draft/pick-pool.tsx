"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { makePick } from "@/server/actions/picks";
import { availablePlayers } from "@/core/draft/rules";
import type { DraftState } from "@/core/draft/types";
import { cn } from "@/lib/utils";
import { CAPTAIN_COLORS } from "./captain-colors";

/** Grid of available players. Clickable only when it is the viewer's turn. */
export function PickPool({
  draft,
  isMyTurn,
  slot,
}: {
  draft: DraftState;
  isMyTurn: boolean;
  /** Slot of the captain on the clock, to tint the hover accent. */
  slot: "A" | "B" | null;
}) {
  const [pending, startTransition] = useTransition();
  const players = availablePlayers(draft.players);
  const hover = slot ? CAPTAIN_COLORS[slot].hover : "";

  function pick(playerId: string) {
    if (!isMyTurn) return;
    startTransition(async () => {
      const result = await makePick(draft.id, playerId);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">Available players</p>
        <span className="text-xs text-muted-foreground">
          {players.length} left
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {players.map((player) => (
          <button
            key={player.id}
            type="button"
            disabled={!isMyTurn || pending}
            onClick={() => pick(player.id)}
            className={cn(
              "rounded-lg border px-3 py-3 text-left text-sm font-medium transition-colors",
              isMyTurn
                ? cn("border-border bg-card active:scale-[0.98]", hover)
                : "cursor-not-allowed border-border/50 bg-muted/40 text-muted-foreground",
            )}
          >
            <span className="line-clamp-2">{player.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
