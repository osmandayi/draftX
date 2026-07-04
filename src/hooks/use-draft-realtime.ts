"use client";

import { useEffect, useState } from "react";
import type { DraftState } from "@/core/draft/types";
import type { DraftRow, PlayerRow } from "@/lib/database.types";
import { createSupabaseBrowserClient } from "@/server/supabase/browser";

function applyDraftRow(state: DraftState, row: DraftRow): DraftState {
  return {
    ...state,
    status: row.status,
    captainA: row.captain_a,
    captainB: row.captain_b,
    currentCaptain: row.current_captain,
    turnIndex: row.turn_index,
    turnSeconds: row.turn_seconds,
    turnDeadline: row.turn_deadline,
  };
}

function applyPlayerRow(state: DraftState, row: PlayerRow): DraftState {
  const player = {
    id: row.id,
    name: row.name,
    draftedBy: row.drafted_by,
    pickNumber: row.pick_number,
  };
  const exists = state.players.some((p) => p.id === row.id);
  const players = exists
    ? state.players.map((p) => (p.id === row.id ? player : p))
    : [...state.players, player];
  return { ...state, players };
}

/**
 * Subscribes to Postgres changes for a single draft and keeps a local
 * DraftState in sync. Listens to `drafts` (turn/deadline/status) and `players`
 * (pool + who got drafted), both filtered by draft id. RLS ensures only draft
 * members receive the stream.
 */
export function useDraftRealtime(initial: DraftState): DraftState {
  const [state, setState] = useState<DraftState>(initial);

  // Adopt fresh server-rendered state (e.g. after a navigation/refresh).
  useEffect(() => {
    setState(initial);
  }, [initial]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`draft:${initial.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "drafts",
          filter: `id=eq.${initial.id}`,
        },
        (payload) => {
          const row = payload.new as DraftRow;
          setState((prev) => applyDraftRow(prev, row));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `draft_id=eq.${initial.id}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id: string }).id;
            setState((prev) => ({
              ...prev,
              players: prev.players.filter((p) => p.id !== oldId),
            }));
            return;
          }
          const row = payload.new as PlayerRow;
          setState((prev) => applyPlayerRow(prev, row));
        },
      );

    // Realtime enforces RLS using the subscriber's JWT. Set it from the current
    // session BEFORE subscribing — otherwise the socket connects as `anon` and
    // our member-only policies silently drop every change (turn never advances
    // on the other client).
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      supabase.realtime.setAuth(data.session?.access_token ?? null);
      channel.subscribe();
    });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [initial.id]);

  return state;
}
