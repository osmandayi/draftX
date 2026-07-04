import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { CAPTAIN_COLORS } from "./captain-colors";
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
  const color = CAPTAIN_COLORS[slot];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Avatar
        className={cn("size-7 ring-2 ring-offset-1 ring-offset-background", color.ring)}
      >
        {captain?.avatarUrl ? <AvatarImage src={captain.avatarUrl} alt="" /> : null}
        <AvatarFallback className="text-xs">{initial}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-medium">{name}</p>
        <p
          className={cn(
            "flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide",
            color.text,
          )}
        >
          <span className={cn("size-1.5 rounded-full", color.dot)} />
          Captain {slot}
        </p>
      </div>
    </div>
  );
}
