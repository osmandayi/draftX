"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { createDraft } from "@/server/actions/drafts";
import type { ActionResult } from "@/server/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Creating…" : "Create draft"}
    </Button>
  );
}

async function action(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult | null> {
  // createDraft redirects on success; only errors return here.
  return createDraft(formData);
}

export function CreateDraftForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    action,
    null,
  );

  useEffect(() => {
    if (state && !state.ok) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Draft name</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={80}
          autoFocus
          placeholder="Friday night 7-a-side"
        />
        <p className="text-xs text-muted-foreground">
          You&apos;ll be Captain A. Invite a second captain from the room.
        </p>
      </div>
      <SubmitButton />
    </form>
  );
}
