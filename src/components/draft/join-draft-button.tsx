"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { joinDraft } from "@/server/actions/drafts";
import { Button } from "@/components/ui/button";

export function JoinDraftButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();

  function join() {
    startTransition(async () => {
      // joinDraft redirects on success; only errors return.
      const result = await joinDraft(token);
      if (result && !result.ok) toast.error(result.error);
    });
  }

  return (
    <Button size="lg" className="w-full" onClick={join} disabled={pending}>
      {pending ? "Joining…" : "Join as Captain B"}
    </Button>
  );
}
