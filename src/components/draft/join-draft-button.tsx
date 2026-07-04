"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { joinDraft } from "@/server/actions/drafts";
import { Button } from "@/components/ui/button";

// Errors that mean this user can never join this draft → send them to safety.
const TERMINAL = ["two captains", "already started"];

export function JoinDraftButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function join() {
    startTransition(async () => {
      // joinDraft redirects on success; only errors return.
      const result = await joinDraft(token);
      if (result && !result.ok) {
        toast.error(result.error);
        if (TERMINAL.some((t) => result.error.toLowerCase().includes(t))) {
          router.push("/dashboard");
        }
      }
    });
  }

  return (
    <Button size="lg" className="w-full" onClick={join} disabled={pending}>
      {pending ? "Joining…" : "Join as Captain B"}
    </Button>
  );
}
