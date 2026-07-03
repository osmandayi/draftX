import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { DraftStatusBadge } from "@/components/draft-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/server/auth";
import { listUserDrafts } from "@/server/repositories/drafts";

export const metadata: Metadata = { title: "Your drafts" };

export default async function DashboardPage() {
  const user = await requireUser();
  const drafts = await listUserDrafts(user.id);

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Your drafts</h1>
            <p className="text-sm text-muted-foreground">
              Create a draft or jump back into a live room.
            </p>
          </div>
          <Button render={<Link href="/drafts/new" />}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">New draft</span>
          </Button>
        </div>

        {drafts.length === 0 ? (
          <Card className="mt-8 border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                You have no drafts yet.
              </p>
              <Button render={<Link href="/drafts/new" />}>
                <Plus className="size-4" />
                Create your first draft
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="mt-6 grid gap-3">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <Link
                  href={
                    draft.status === "completed"
                      ? `/history/${draft.id}`
                      : `/drafts/${draft.id}/room`
                  }
                >
                  <Card className="transition-colors hover:border-primary/50">
                    <CardContent className="flex items-center justify-between gap-3 py-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {draft.name}
                          </span>
                          <DraftStatusBadge status={draft.status} />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {draft.creator_id === user.id
                            ? "You created this"
                            : "You joined this"}{" "}
                          · {new Date(draft.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
