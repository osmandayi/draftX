"use client";

import { useState, useTransition } from "react";
import { Play, Timer } from "lucide-react";
import { toast } from "sonner";
import { startDraft } from "@/server/actions/drafts";
import {
  TURN_SECONDS_DEFAULT,
  TURN_SECONDS_MAX,
  TURN_SECONDS_MIN,
  TURN_SECONDS_STEP,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

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
  const [seconds, setSeconds] = useState(TURN_SECONDS_DEFAULT);

  function start() {
    startTransition(async () => {
      const result = await startDraft(draftId, seconds);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Timer className="size-4 text-primary" />
            Turn timer
          </span>
          <span className="text-sm tabular-nums text-muted-foreground">
            <span className="font-semibold text-foreground">{seconds}</span>s
          </span>
        </div>
        <Slider
          value={seconds}
          onValueChange={(value) => setSeconds(value)}
          min={TURN_SECONDS_MIN}
          max={TURN_SECONDS_MAX}
          step={TURN_SECONDS_STEP}
          disabled={pending}
          aria-label="Seconds per turn"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{TURN_SECONDS_MIN}s</span>
          <span>{TURN_SECONDS_MAX}s</span>
        </div>
      </div>

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
