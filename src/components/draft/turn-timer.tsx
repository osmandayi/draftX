"use client";

import { useCountdown } from "@/hooks/use-countdown";
import { TURN_SECONDS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Circular 120s countdown driven by the absolute `turn_deadline`. Fires
 * `onExpire` once when it hits zero (both clients fire; the RPC is idempotent).
 */
export function TurnTimer({
  deadline,
  onExpire,
}: {
  deadline: string | null;
  onExpire: () => void;
}) {
  const secondsLeft = useCountdown(deadline, onExpire);
  const pct = Math.max(0, Math.min(1, secondsLeft / TURN_SECONDS));
  const urgent = secondsLeft <= 15;

  const radius = 26;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative flex size-16 items-center justify-center">
      <svg className="absolute size-16 -rotate-90" viewBox="0 0 64 64">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="5"
          className="stroke-muted"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          className={cn(
            "transition-[stroke-dashoffset] duration-300 ease-linear",
            urgent ? "stroke-destructive" : "stroke-primary",
          )}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
        />
      </svg>
      <span
        className={cn(
          "text-lg font-semibold tabular-nums",
          urgent && "text-destructive",
        )}
      >
        {secondsLeft}
      </span>
    </div>
  );
}
