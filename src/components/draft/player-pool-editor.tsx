"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { addPlayer, removePlayer } from "@/server/actions/players";
import type { DraftPlayer } from "@/core/draft/types";
import {
  type SavedPlayer,
  filterSuggestions,
  isNameInList,
  normalizeName,
} from "@/core/roster/match";
import { DRAFTABLE_PLAYERS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Add / remove the 12 draftable player names while in the lobby. Names can be
 * typed (with autocomplete against the user's saved roster) or picked from the
 * "Listemden seç" chip panel. Adding auto-saves to the roster server-side; we
 * mirror that locally so the panel updates without a refetch.
 */
export function PlayerPoolEditor({
  draftId,
  players,
  savedPlayers,
}: {
  draftId: string;
  players: DraftPlayer[];
  savedPlayers: SavedPlayer[];
}) {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<SavedPlayer[]>(savedPlayers);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const refocus = useRef(false);

  const full = players.length >= DRAFTABLE_PLAYERS;
  const poolNames = players.map((p) => p.name);
  const suggestions = filterSuggestions(name, saved, poolNames);

  useEffect(() => {
    if (pending || !refocus.current) return;
    refocus.current = false;
    if (!full) inputRef.current?.focus();
  }, [pending, full]);

  function add(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setShowSuggestions(false);
    startTransition(async () => {
      const result = await addPlayer(draftId, trimmed);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setName("");
      refocus.current = true;
      // Auto-save happens server-side; mirror it so the chip panel reflects the
      // new name immediately (deduped by normalized name).
      setSaved((prev) =>
        isNameInList(trimmed, prev)
          ? prev
          : [
              ...prev,
              {
                id: `local-${normalizeName(trimmed)}`,
                name: trimmed,
                created_at: new Date().toISOString(),
              },
            ],
      );
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

      <div className="relative">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add(name);
          }}
          className="flex gap-2"
        >
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
            maxLength={60}
            placeholder={full ? "Pool is full" : "Add a player name"}
            disabled={full || pending}
          />
          <Button type="submit" disabled={full || pending} className="shrink-0">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add</span>
          </Button>
        </form>

        {showSuggestions && !full && suggestions.length > 0 ? (
          <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border/60 bg-popover p-1 shadow-md">
            {suggestions.slice(0, 8).map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  // Fire before input blur so the click registers.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(s.name)}
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {saved.length > 0 ? (
        <div className="rounded-lg border border-border/60">
          <button
            type="button"
            onClick={() => setBrowseOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-sm text-muted-foreground"
          >
            <span>Listemden seç ({saved.length})</span>
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                browseOpen && "rotate-180",
              )}
            />
          </button>
          {browseOpen ? (
            <div className="flex flex-wrap gap-2 px-3 pb-3">
              {saved.map((s) => {
                const inPool = isNameInList(s.name, players);
                const disabled = inPool || full || pending;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => add(s.name)}
                    disabled={disabled}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors",
                      disabled
                        ? "border-border/40 text-muted-foreground/50"
                        : "border-border/60 hover:border-primary/50 hover:bg-accent",
                    )}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

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
