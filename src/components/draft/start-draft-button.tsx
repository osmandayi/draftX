"use client";

import { useTransition } from "react";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { startDraft } from "@/server/actions/drafts";
import { Button } from "@/components/ui/button";

export function StartDraftButton({
  draftId,
  disabled,
  hint,
}: {
  draftId: string;
  disabled: boolean;
  hint: string;
}) {
  const [pending, startTransition] = useTransition();

  function start() {
    startTransition(async () => {
      const result = await startDraft(draftId);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-2">
      <Button
        size="lg"
        className="w-full"
        onClick={start}
        disabled={disabled || pending}
      >
        <Play className="size-4" />
        {pending ? "Starting…" : "Start draft"}
      </Button>
      {disabled ? (
        <p className="text-center text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
