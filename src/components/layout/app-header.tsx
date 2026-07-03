import Link from "next/link";
import { Trophy } from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { getProfile } from "@/server/repositories/profiles";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

/** App chrome shown on authenticated pages. Mobile-first, sticky top bar. */
export async function AppHeader() {
  const user = await getCurrentUser();
  const profile = user ? await getProfile(user.id) : null;
  const initial = (profile?.display_name ?? "?").charAt(0).toUpperCase();

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
          <Link href="/profile" aria-label="Profile" className="ml-1">
            <Avatar className="size-8">
              {profile?.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt="" />
              ) : null}
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
          </Link>
        </nav>
      </div>
    </header>
  );
}
