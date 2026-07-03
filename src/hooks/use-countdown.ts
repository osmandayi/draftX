"use client";

import { useEffect, useRef, useState } from "react";

function secondsUntil(deadline: string | null): number {
  if (!deadline) return 0;
  const ms = new Date(deadline).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 1000));
}

/**
 * Renders the seconds remaining until an absolute `deadline` timestamp. Using
 * an absolute deadline (rather than a local counter) keeps both clients in
 * sync even if their render loops drift. Fires `onExpire` once per deadline.
 */
export function useCountdown(
  deadline: string | null,
  onExpire?: () => void,
): number {
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(deadline));
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    firedRef.current = false;

    if (!deadline) {
      setSecondsLeft(0);
      return;
    }

    const tick = () => {
      const remaining = secondsUntil(deadline);
      setSecondsLeft(remaining);
      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current?.();
      }
    };

    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [deadline]);

  return secondsLeft;
}
