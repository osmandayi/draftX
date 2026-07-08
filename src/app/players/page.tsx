import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/server/auth";
import { listSavedPlayers } from "@/server/repositories/saved-players";
import { SavedPlayersEditor } from "@/components/saved-players-editor";

export const metadata: Metadata = { title: "Oyuncularım" };

export default async function PlayersPage() {
  await requireUser();
  const players = await listSavedPlayers();

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">Oyuncularım</h1>
          <p className="text-sm text-muted-foreground">
            Kayıtlı oyuncuların. Draftlarda buradan hızlıca ekleyebilirsin.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <SavedPlayersEditor players={players} />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
