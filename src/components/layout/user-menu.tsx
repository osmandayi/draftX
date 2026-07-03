"use client";

import Link from "next/link";
import { LogOut, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Avatar button in the header that opens a Profile / Sign out menu. */
export function UserMenu({
  displayName,
  avatarUrl,
  email,
}: {
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
}) {
  const initial = (displayName || email || "?").charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="ml-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="size-8">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuLabel className="truncate">
          {displayName || "Captain"}
          {email ? (
            <span className="block truncate font-normal text-muted-foreground">
              {email}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLinkItem render={<Link href="/profile" />}>
          <User />
          Profile
        </DropdownMenuLinkItem>
        <DropdownMenuSeparator />
        <form action="/auth/signout" method="post">
          <DropdownMenuItem
            render={<button type="submit" />}
            className="text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive [&_svg]:text-destructive"
          >
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
