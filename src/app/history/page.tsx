import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, History as HistoryIcon } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/server/auth";
import { listUserDrafts } from "@/server/repositories/drafts";

export const metadata: Metadata = { title: "History" };

export default async function HistoryPage() {
  const user = await requireUser();
  const drafts = (await listUserDrafts(user.id)).filter(
    (d) => d.status === "completed",
  );

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold">Draft history</h1>
        <p className="text-sm text-muted-foreground">
          Completed drafts with final teams and full pick order.
        </p>

        {drafts.length === 0 ? (
          <Card className="mt-8 border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <HistoryIcon className="size-6" />
              No completed drafts yet.
            </CardContent>
          </Card>
        ) : (
          <ul className="mt-6 grid gap-3">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <Link href={`/history/${draft.id}`}>
                  <Card className="transition-colors hover:border-primary/50">
                    <CardContent className="flex items-center justify-between gap-3 py-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{draft.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Completed{" "}
                          {draft.completed_at
                            ? new Date(draft.completed_at).toLocaleString()
                            : "—"}
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
