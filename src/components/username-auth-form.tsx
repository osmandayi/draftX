"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/server/supabase/browser";
import {
  identifierToEmail,
  isValidUsername,
  normalizeUsername,
  usernameToEmail,
  USERNAME_MAX,
} from "@/lib/username";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "signin" | "signup";

/**
 * Username + password auth on top of Supabase, alongside Google. Sign-up takes
 * a username (backed by a synthetic email); sign-in accepts a username OR a
 * linked email. New accounts get a `profiles` row via the `handle_new_user`
 * trigger, which reads the username from sign-up metadata.
 */
export function UsernameAuthForm({ next = "/dashboard" }: { next?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const supabase = createSupabaseBrowserClient();

    try {
      if (mode === "signup") {
        const uname = normalizeUsername(username);
        if (!isValidUsername(uname)) {
          toast.error(
            `Username must be 3–${USERNAME_MAX} characters: a–z, 0–9, underscore.`,
          );
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: usernameToEmail(uname),
          password,
          options: { data: { username: uname } },
        });
        if (error) {
          throw new Error(
            /already registered/i.test(error.message)
              ? "That username is already taken."
              : error.message,
          );
        }
        if (!data.session) {
          // Email confirmation is on: a synthetic address can't be confirmed.
          toast.error(
            "Turn off email confirmation in Supabase to allow username sign-up.",
          );
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: identifierToEmail(identifier),
          password,
        });
        if (error) throw new Error("Invalid username/email or password.");
      }
      router.push(next);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 text-left">
      {mode === "signup" ? (
        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. captain_bob"
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="identifier">Username or email</Label>
          <Input
            id="identifier"
            autoComplete="username"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="captain_bob"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading
          ? "Please wait…"
          : mode === "signup"
            ? "Create account"
            : "Sign in"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="font-medium text-primary hover:underline"
        >
          {mode === "signup" ? "Sign in" : "Create one"}
        </button>
      </p>
    </form>
  );
}
