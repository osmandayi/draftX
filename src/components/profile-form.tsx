"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { updateDisplayName } from "@/server/actions/profile";
import type { ActionResult } from "@/server/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

async function action(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult | null> {
  return updateDisplayName(formData);
}

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    action,
    null,
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success("Profile updated");
    else toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="display_name">Display name</Label>
        <div className="flex gap-2">
          <Input
            id="display_name"
            name="display_name"
            defaultValue={displayName}
            maxLength={40}
            required
          />
          <SaveButton />
        </div>
        <p className="text-xs text-muted-foreground">
          This is how you appear to the other captain.
        </p>
      </div>
    </form>
  );
}
