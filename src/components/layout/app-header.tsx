import Link from "next/link";
import { Trophy } from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { getProfile } from "@/server/repositories/profiles";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";

/** App chrome shown on authenticated pages. Mobile-first, sticky top bar. */
export async function AppHeader() {
  const user = await getCurrentUser();
  const profile = user ? await getProfile(user.id) : null;

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between gap-2 px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Trophy className="size-4" />
          </span>
          <span className="hidden sm:inline">Captain Draft</span>
        </Link>

        <nav className="flex items-center gap-1">
          <Button variant="ghost" size="sm" render={<Link href="/dashboard" />}>
            Drafts
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/history" />}>
            History
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/players" />}>
            Oyuncularım
          </Button>
          <UserMenu
            displayName={profile?.display_name ?? ""}
            avatarUrl={profile?.avatar_url ?? null}
            email={user?.email ?? null}
          />
        </nav>
      </div>
    </header>
  );
}
