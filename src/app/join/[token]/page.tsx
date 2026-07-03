import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, Users } from "lucide-react";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { JoinDraftButton } from "@/components/draft/join-draft-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/server/auth";
import { getInvite } from "@/server/repositories/drafts";
import { DRAFTABLE_PLAYERS } from "@/lib/constants";

export const metadata: Metadata = { title: "Join draft" };

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [user, invite] = await Promise.all([getCurrentUser(), getInvite(token)]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center justify-center gap-2 text-primary">
        <Trophy className="size-6" />
        <span className="text-lg font-semibold">Captain Draft</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>You&apos;re invited to a draft</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {!invite ? (
            <p className="text-sm text-muted-foreground">
              This invite link is invalid or has expired.
            </p>
          ) : (
            <>
              <div className="rounded-lg border border-border/60 bg-muted/40 p-4">
                <p className="text-lg font-semibold">{invite.name}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="size-4" />
                  Captain A: {invite.captain_name ?? "Unknown"} ·{" "}
                  {invite.player_count}/{DRAFTABLE_PLAYERS} players
                </p>
              </div>

              {invite.status !== "lobby" ? (
                <p className="text-sm text-muted-foreground">
                  This draft has already started and can&apos;t be joined.
                </p>
              ) : invite.has_second ? (
                <p className="text-sm text-muted-foreground">
                  This draft already has two captains.
                </p>
              ) : !user ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Sign in to join as Captain B.
                  </p>
                  <GoogleSignInButton
                    next={`/join/${token}`}
                    label="Sign in with Google"
                    className="w-full"
                  />
                </div>
              ) : (
                <JoinDraftButton token={token} />
              )}
            </>
          )}

          <Button
            variant="ghost"
            className="w-full"
            render={<Link href={user ? "/dashboard" : "/"} />}
          >
            {user ? "Go to dashboard" : "Back to home"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
