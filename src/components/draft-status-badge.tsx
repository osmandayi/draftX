import { Badge } from "@/components/ui/badge";
import type { DraftStatus } from "@/lib/database.types";
import { cn } from "@/lib/utils";

const MAP: Record<DraftStatus, { label: string; className: string }> = {
  lobby: {
    label: "Lobby",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  active: {
    label: "Live",
    className: "bg-primary/15 text-primary animate-pulse",
  },
  completed: {
    label: "Completed",
    className: "bg-muted text-muted-foreground",
  },
};

export function DraftStatusBadge({ status }: { status: DraftStatus }) {
  const { label, className } = MAP[status];
  return (
    <Badge variant="secondary" className={cn("border-transparent", className)}>
      {label}
    </Badge>
  );
}
