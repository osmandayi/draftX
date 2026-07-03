import type { Metadata } from "next";
import { LogOut, Mail } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { ProfileForm } from "@/components/profile-form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireUser } from "@/server/auth";
import { getProfile } from "@/server/repositories/profiles";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const displayName = profile?.display_name ?? "";
  const initial = (displayName || user.email || "?").charAt(0).toUpperCase();

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold">Profile</h1>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Avatar className="size-12">
                {profile?.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt="" />
                ) : null}
                <AvatarFallback>{initial}</AvatarFallback>
              </Avatar>
              <span className="min-w-0">
                <span className="block truncate text-base">
                  {displayName || "Captain"}
                </span>
                <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                  <Mail className="size-3" />
                  {user.email}
                </span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProfileForm displayName={displayName} />
            <Separator />
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="outline" className="w-full">
                <LogOut className="size-4" />
                Sign out
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
