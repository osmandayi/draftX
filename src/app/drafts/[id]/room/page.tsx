import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { DraftRoom } from "@/components/draft/draft-room";
import type { CaptainMap } from "@/components/draft/types";
import { requireUser } from "@/server/auth";
import {
  getDraftWithPlayers,
  toDraftState,
} from "@/server/repositories/drafts";
import { getProfilesByIds } from "@/server/repositories/profiles";
import { listSavedPlayers } from "@/server/repositories/saved-players";

export const metadata: Metadata = { title: "Draft room" };

export default async function DraftRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const result = await getDraftWithPlayers(id);
  // RLS hides drafts the user isn't a member of, so null == not found/forbidden.
  if (!result) notFound();

  const { draft, players } = result;
  const state = toDraftState(draft, players);
  const savedPlayers = await listSavedPlayers();

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

  return (
    <>
      <AppHeader />
      <main className="w-full flex-1 px-4 py-6">
        <DraftRoom
          name={draft.name}
          initialDraft={state}
          currentUserId={user.id}
          isCreator={draft.creator_id === user.id}
          inviteToken={draft.invite_token}
          initialCaptains={captains}
          initialSavedPlayers={savedPlayers}
        />
      </main>
    </>
  );
}
