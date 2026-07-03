import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Timer, Trophy } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { TeamPanel } from "@/components/draft/team-panel";
import type { CaptainMap } from "@/components/draft/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/auth";
import {
  getDraftWithPlayers,
  toDraftState,
} from "@/server/repositories/drafts";
import { listPicks } from "@/server/repositories/picks";
import { getProfilesByIds } from "@/server/repositories/profiles";

export const metadata: Metadata = { title: "Draft result" };

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();

  const [result, picks] = await Promise.all([
    getDraftWithPlayers(id),
    listPicks(id),
  ]);
  if (!result) notFound();

  const { draft, players } = result;
  const state = toDraftState(draft, players);

  const profiles = await getProfilesByIds([
    draft.captain_a ?? "",
    draft.captain_b ?? "",
  ]);
  const captains: CaptainMap = Object.fromEntries(
    Object.values(profiles).map((p) => [
      p.id,
      { id: p.id, name: p.display_name ?? "Captain", avatarUrl: p.avatar_url },
    ]),
  );
  const playerName = new Map(players.map((p) => [p.id, p.name]));

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <Link
          href="/history"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to history
        </Link>

        <div className="mb-4 flex items-center gap-2">
          <Trophy className="size-5 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">{draft.name}</h1>
            <p className="text-xs text-muted-foreground">
              Completed{" "}
              {draft.completed_at
                ? new Date(draft.completed_at).toLocaleString()
                : "—"}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <TeamPanel draft={state} slot="A" captains={captains} onClock={false} />
          <TeamPanel draft={state} slot="B" captains={captains} onClock={false} />
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Pick order</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1.5">
              {picks.map((pick) => (
                <li
                  key={pick.id}
                  className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2 text-sm"
                >
                  <span className="w-6 text-center font-semibold tabular-nums text-muted-foreground">
                    {pick.pick_number}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {playerName.get(pick.player_id) ?? "Unknown"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {captains[pick.captain_id]?.name ?? "Captain"}
                  </span>
                  {pick.was_auto ? (
                    <Badge
                      variant="secondary"
                      className="gap-1 border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    >
                      <Timer className="size-3" />
                      Auto
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
