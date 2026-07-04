"use client";

import { useTransition } from "react";
import { UserMinus } from "lucide-react";
import { toast } from "sonner";
import { removeCaptainB } from "@/server/actions/drafts";
import { Button } from "@/components/ui/button";

/** Creator-only kick for Captain B while in the lobby. */
export function RemoveCaptainButton({ draftId }: { draftId: string }) {
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await removeCaptainB(draftId);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={remove}
      disabled={pending}
      aria-label="Remove Captain B"
      title="Remove Captain B"
      className="ml-auto shrink-0 text-muted-foreground hover:text-destructive"
    >
      <UserMinus className="size-4" />
    </Button>
  );
}
