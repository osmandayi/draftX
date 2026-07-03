"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/server/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Attach a real email to a username account. Supabase sends a confirmation
 * link to the address; once clicked, the user can also sign in with that email
 * and use password recovery.
 */
export function LinkEmailForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ email });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Confirmation link sent to ${email}.`);
      setEmail("");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <Label htmlFor="link-email">Link an email</Label>
      <div className="flex gap-2">
        <Input
          id="link-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <Button type="submit" disabled={loading} className="shrink-0">
          <Link2 className="size-4" />
          {loading ? "Sending…" : "Link"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Optional — add a real email for password recovery. You&apos;ll confirm
        it via a link, then can sign in with it too.
      </p>
    </form>
  );
}
