"use client";

import { UserCheck, UserPlus } from "lucide-react";
import { canStart } from "@/core/draft/rules";
import type { SavedPlayer } from "@/core/roster/match";
import type { DraftState } from "@/core/draft/types";
import { DRAFTABLE_PLAYERS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CaptainTag } from "./captain-tag";
import { CAPTAIN_COLORS } from "./captain-colors";
import { InviteButton } from "./invite-button";
import { PlayerPoolEditor } from "./player-pool-editor";
import { RemoveCaptainButton } from "./remove-captain-button";
import { StartDraftButton } from "./start-draft-button";
import type { CaptainMap } from "./types";

export function Lobby({
  draft,
  isCreator,
  inviteToken,
  captains,
  savedPlayers,
}: {
  draft: DraftState;
  isCreator: boolean;
  inviteToken: string;
  captains: CaptainMap;
  savedPlayers: SavedPlayer[];
}) {
  const ready = canStart(draft);
  const hasSecond = !!draft.captainB;

  const hint = !hasSecond
    ? "Waiting for a second captain to join."
    : draft.players.length < DRAFTABLE_PLAYERS
      ? `Add ${DRAFTABLE_PLAYERS - draft.players.length} more player(s).`
      : "Ready when you are.";

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Captains</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2">
            <UserCheck className={cn("size-4", CAPTAIN_COLORS.A.text)} />
            <CaptainTag
              captain={draft.captainA ? captains[draft.captainA] : null}
              slot="A"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2">
            {hasSecond ? (
              <UserCheck className={cn("size-4", CAPTAIN_COLORS.B.text)} />
            ) : (
              <UserPlus className="size-4 text-muted-foreground" />
            )}
            {hasSecond ? (
              <CaptainTag
                captain={draft.captainB ? captains[draft.captainB] : null}
                slot="B"
              />
            ) : (
              <span className="text-sm text-muted-foreground">
                Open — share the invite link
              </span>
            )}
            {hasSecond && isCreator ? (
              <RemoveCaptainButton draftId={draft.id} />
            ) : null}
          </div>

          {!hasSecond ? (
            <>
              <Separator />
              <InviteButton token={inviteToken} />
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <PlayerPoolEditor
            draftId={draft.id}
            players={draft.players}
            savedPlayers={savedPlayers}
          />
        </CardContent>
      </Card>

      {isCreator ? (
        <StartDraftButton draftId={draft.id} disabled={!ready} hint={hint} />
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Waiting for the creator to start the draft. {hint}
        </p>
      )}
    </div>
  );
}
