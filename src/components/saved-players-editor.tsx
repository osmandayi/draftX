"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  addSavedPlayer,
  removeSavedPlayer,
} from "@/server/actions/saved-players";
import { type SavedPlayer, isNameInList } from "@/core/roster/match";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Manage the current user's personal roster: add and remove saved names. */
export function SavedPlayersEditor({ players }: { players: SavedPlayer[] }) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (isNameInList(trimmed, players)) {
      toast.error("Bu isim listende zaten var.");
      return;
    }
    startTransition(async () => {
      const result = await addSavedPlayer(trimmed);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setName("");
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await removeSavedPlayer(id);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex gap-2"
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Oyuncu adı ekle"
          disabled={pending}
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Ekle</span>
        </Button>
      </form>

      {players.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 py-6 text-center text-sm text-muted-foreground">
          Henüz kayıtlı oyuncun yok. Bir draftta oyuncu ekledikçe burası dolar.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {players.map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm"
            >
              <span className="truncate">{player.name}</span>
              <button
                type="button"
                onClick={() => remove(player.id)}
                disabled={pending}
                aria-label={`${player.name} sil`}
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
