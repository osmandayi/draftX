"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useDraftRealtime } from "@/hooks/use-draft-realtime";
import { createSupabaseBrowserClient } from "@/server/supabase/browser";
import type { DraftState } from "@/core/draft/types";
import { DraftStatusBadge } from "@/components/draft-status-badge";
import { Button } from "@/components/ui/button";
import { DraftBoard } from "./draft-board";
import { Lobby } from "./lobby";
import { TeamPanel } from "./team-panel";
import type { CaptainMap } from "./types";

/**
 * Client orchestrator for a single draft. Subscribes to realtime and renders
 * the lobby, live board, or final results depending on status. Captain
 * profiles that arrive after load (e.g. Captain B joining) are fetched on the
 * fly so names stay correct without a refresh.
 */
export function DraftRoom({
  name,
  initialDraft,
  currentUserId,
  isCreator,
  inviteToken,
  initialCaptains,
}: {
  name: string;
  initialDraft: DraftState;
  currentUserId: string;
  isCreator: boolean;
  inviteToken: string;
  initialCaptains: CaptainMap;
}) {
  const draft = useDraftRealtime(initialDraft);
  const [captains, setCaptains] = useState<CaptainMap>(initialCaptains);

  useEffect(() => {
    const ids = [draft.captainA, draft.captainB].filter(
      (id): id is string => !!id && !captains[id],
    );
    if (ids.length === 0) return;

    const supabase = createSupabaseBrowserClient();
    supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", ids)
      .then(({ data }) => {
        if (!data?.length) return;
        setCaptains((prev) => {
          const next = { ...prev };
          for (const p of data) {
            next[p.id] = {
              id: p.id,
              name: p.display_name ?? "Captain",
              avatarUrl: p.avatar_url,
            };
          }
          return next;
        });
      });
  }, [draft.captainA, draft.captainB, captains]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="truncate text-xl font-semibold">{name}</h1>
        <DraftStatusBadge status={draft.status} />
      </div>

      {draft.status === "lobby" ? (
        <Lobby
          draft={draft}
          isCreator={isCreator}
          inviteToken={inviteToken}
          captains={captains}
        />
      ) : draft.status === "active" ? (
        <DraftBoard
          draft={draft}
          currentUserId={currentUserId}
          captains={captains}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 p-4 text-primary">
            <CheckCircle2 className="size-5" />
            <p className="font-medium">Draft complete — squads are set!</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TeamPanel draft={draft} slot="A" captains={captains} onClock={false} />
            <TeamPanel draft={draft} slot="B" captains={captains} onClock={false} />
          </div>
          <Button
            variant="outline"
            className="w-full"
            render={<Link href={`/history/${draft.id}`} />}
          >
            View full pick order
          </Button>
        </div>
      )}
    </div>
  );
}
