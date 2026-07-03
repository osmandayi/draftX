import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { CaptainInfo } from "./types";

export function CaptainTag({
  captain,
  slot,
  className,
}: {
  captain?: CaptainInfo | null;
  slot: "A" | "B";
  className?: string;
}) {
  const name = captain?.name ?? "Waiting…";
  const initial = (captain?.name ?? "?").charAt(0).toUpperCase();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Avatar className="size-7">
        {captain?.avatarUrl ? <AvatarImage src={captain.avatarUrl} alt="" /> : null}
        <AvatarFallback className="text-xs">{initial}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Captain {slot}
        </p>
      </div>
    </div>
  );
}
