"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { addPlayer, removePlayer } from "@/server/actions/players";
import type { DraftPlayer } from "@/core/draft/types";
import { DRAFTABLE_PLAYERS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Add / remove the 12 draftable player names while in the lobby. */
export function PlayerPoolEditor({
  draftId,
  players,
}: {
  draftId: string;
  players: DraftPlayer[];
}) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const full = players.length >= DRAFTABLE_PLAYERS;

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await addPlayer(draftId, trimmed);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setName("");
      inputRef.current?.focus();
    });
  }

  function remove(playerId: string) {
    startTransition(async () => {
      const result = await removePlayer(draftId, playerId);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Player pool</p>
        <span className="text-xs text-muted-foreground">
          {players.length}/{DRAFTABLE_PLAYERS}
        </span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex gap-2"
      >
        <Input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder={full ? "Pool is full" : "Add a player name"}
          disabled={full || pending}
        />
        <Button type="submit" disabled={full || pending} className="shrink-0">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Add</span>
        </Button>
      </form>

      {players.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 py-6 text-center text-sm text-muted-foreground">
          Add {DRAFTABLE_PLAYERS} players to start the draft.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {players.map((player, i) => (
            <li
              key={player.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="truncate">{player.name}</span>
              </span>
              <button
                type="button"
                onClick={() => remove(player.id)}
                disabled={pending}
                aria-label={`Remove ${player.name}`}
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
