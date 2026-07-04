# Abuse Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-user rate limiting to mutating endpoints, restrict `profiles` visibility to draft co-members, and polish the join-race UX.

**Architecture:** Rate limiting uses Upstash Redis (`@upstash/ratelimit`) behind a thin `src/server/rate-limit.ts` helper that no-ops when Upstash env vars are absent (so dev/CI are unaffected). Limits are keyed by the authenticated user id, enforced inside existing Server Actions and the tick route handler. A new SQL migration replaces the world-readable `profiles` select policy with a self-or-co-member policy. The invite preview is unaffected because it flows through the `SECURITY DEFINER` `get_invite` RPC.

**Tech Stack:** Next.js 15 (App Router, Server Actions, route handlers), Supabase (Postgres + RLS + RPC), Upstash Redis, TypeScript (strict), Vitest.

## Global Constraints

- Next.js version is pinned; this is a customized Next build. **Before editing any route handler or server action, read the relevant guide under `node_modules/next/dist/docs/`** (AGENTS.md requirement).
- All mutating server actions already call `requireUser()` and return `ActionResult` via `ok()` / `fail()` from `src/server/actions/types.ts`. Preserve that shape.
- Rate-limit rejection copy (Turkish), used verbatim: `"Çok fazla istek, biraz yavaşla. Lütfen birkaç saniye bekle."`
- The Upstash helper MUST no-op (return `{ ok: true }`) when `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` is unset.
- Ship order: Task 1 (RLS) → Tasks 2–4 (rate limiting) → Task 5 (UX).

---

### Task 1: Restrict `profiles` RLS to self-or-co-member

**Files:**
- Create: `supabase/migrations/0006_profiles_rls.sql`

**Interfaces:**
- Consumes: existing `public.profiles` and `public.drafts` tables, `profiles_select` policy from `0001_init.sql:443`.
- Produces: a tightened `profiles_select` policy. No code interface.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0006_profiles_rls.sql`:

```sql
-- Restrict profile visibility: a user may read their own profile and the
-- profiles of anyone they share a draft with. Replaces the world-readable
-- policy from 0001_init.sql. The invite preview keeps working because it reads
-- captain_a's name through the SECURITY DEFINER get_invite() RPC (bypasses RLS).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.drafts d
      where (d.creator_id = auth.uid()
          or d.captain_a  = auth.uid()
          or d.captain_b  = auth.uid())
        and profiles.id in (d.creator_id, d.captain_a, d.captain_b)
    )
  );
```

- [ ] **Step 2: Apply the migration**

Run it against the Supabase project (SQL Editor, or `supabase db push` if the CLI is wired up). Expected: `CREATE POLICY` succeeds with no error.

- [ ] **Step 3: Manually verify visibility is intact**

With two accounts sharing a draft:
- Open the room as each captain → both captain names render (covers `draft-room.tsx:48` browser read + `getProfilesByIds` server read).
- Open the completed draft under History → both names render.
- Open the invite link `/join/<token>` while signed in as a **third** account that is NOT a member → Captain A's name still shows (via `get_invite`).

Expected: all names visible in the three cases above.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0006_profiles_rls.sql
git commit -m "Restrict profiles RLS to self and draft co-members"
```

---

### Task 2: Rate-limit helper module + dependencies

**Files:**
- Modify: `package.json` (add deps)
- Modify: `.env.example`
- Create: `src/server/rate-limit.ts`
- Test: `src/server/rate-limit.test.ts`

**Interfaces:**
- Produces:
  - `type LimitKind = "tick" | "create" | "join" | "pool" | "pick" | "manage" | "profile"`
  - `async function checkLimit(userId: string, kind: LimitKind): Promise<{ ok: boolean; retryAfter: number }>` — returns `{ ok: true, retryAfter: 0 }` when Upstash env is unset OR when under the limit; `{ ok: false, retryAfter: <seconds> }` when over the limit.
  - `const RATE_LIMIT_MESSAGE = "Çok fazla istek, biraz yavaşla. Lütfen birkaç saniye bekle."`

- [ ] **Step 1: Add dependencies**

Run:

```bash
npm install @upstash/ratelimit @upstash/redis
```

Expected: both appear under `dependencies` in `package.json`; install exits 0.

- [ ] **Step 2: Document env vars**

Append to `.env.example`:

```
# Optional: Upstash Redis for rate limiting. If unset, rate limiting is disabled
# (helper no-ops) so local dev works without it.
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

- [ ] **Step 3: Write the failing test**

Create `src/server/rate-limit.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ORIGINAL = { ...process.env };

describe("checkLimit", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });
  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it("no-ops (allows) when Upstash env is not configured", async () => {
    const { checkLimit } = await import("./rate-limit");
    const result = await checkLimit("user-123", "pick");
    expect(result).toEqual({ ok: true, retryAfter: 0 });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/server/rate-limit.test.ts`
Expected: FAIL — cannot resolve `./rate-limit` (module not yet created).

- [ ] **Step 5: Implement the helper**

Create `src/server/rate-limit.ts`:

```ts
import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const RATE_LIMIT_MESSAGE =
  "Çok fazla istek, biraz yavaşla. Lütfen birkaç saniye bekle.";

export type LimitKind =
  | "tick"
  | "create"
  | "join"
  | "pool"
  | "pick"
  | "manage"
  | "profile";

// Per-user sliding windows. Tuned so normal play never trips them.
const WINDOWS: Record<LimitKind, { limit: number; window: `${number} ${"s" | "m"}` }> = {
  tick: { limit: 12, window: "10 s" },
  create: { limit: 5, window: "1 m" },
  join: { limit: 10, window: "1 m" },
  pool: { limit: 40, window: "1 m" },
  pick: { limit: 30, window: "1 m" },
  manage: { limit: 10, window: "1 m" },
  profile: { limit: 10, window: "1 m" },
};

function redisFromEnv(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// Lazily built, memoized per-kind limiters. Null when Upstash is unconfigured.
let limiters: Partial<Record<LimitKind, Ratelimit>> | null | undefined;

function limiterFor(kind: LimitKind): Ratelimit | null {
  if (limiters === undefined) {
    const redis = redisFromEnv();
    limiters = redis ? {} : null;
  }
  if (limiters === null) return null;
  if (!limiters[kind]) {
    const { limit, window } = WINDOWS[kind];
    limiters[kind] = new Ratelimit({
      redis: redisFromEnv()!,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: `rl:${kind}`,
    });
  }
  return limiters[kind]!;
}

/**
 * Check the per-user rate limit for an action kind. No-ops (allows) when
 * Upstash env vars are unset, so local dev and CI are unaffected.
 */
export async function checkLimit(
  userId: string,
  kind: LimitKind,
): Promise<{ ok: boolean; retryAfter: number }> {
  const limiter = limiterFor(kind);
  if (!limiter) return { ok: true, retryAfter: 0 };

  const { success, reset } = await limiter.limit(userId);
  if (success) return { ok: true, retryAfter: 0 };
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return { ok: false, retryAfter };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/server/rate-limit.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .env.example src/server/rate-limit.ts src/server/rate-limit.test.ts
git commit -m "Add Upstash rate-limit helper with no-op dev fallback"
```

---

### Task 3: Enforce limits in mutating Server Actions

**Files:**
- Modify: `src/server/actions/drafts.ts` (createDraft, joinDraft, removeCaptainB, startDraft)
- Modify: `src/server/actions/players.ts` (addPlayer, removePlayer)
- Modify: `src/server/actions/picks.ts` (makePick)
- Modify: `src/server/actions/profile.ts` (updateDisplayName)

**Interfaces:**
- Consumes: `checkLimit`, `RATE_LIMIT_MESSAGE`, `LimitKind` from `src/server/rate-limit.ts` (Task 2); `fail()` from `src/server/actions/types.ts`; `requireUser()` from `src/server/auth.ts`.
- Produces: no new interface; behavior change only.

Pattern for every action: capture the user (`const user = await requireUser()`), then gate before touching Supabase:

```ts
const gate = await checkLimit(user.id, "<kind>");
if (!gate.ok) return fail(RATE_LIMIT_MESSAGE);
```

- [ ] **Step 1: Read the Next server-actions guide**

Read the server actions guide under `node_modules/next/dist/docs/` before editing (AGENTS.md). Confirm nothing about the `"use server"` action signature contradicts the edits below.

- [ ] **Step 2: Gate `drafts.ts`**

In `src/server/actions/drafts.ts`, add the import and gate each action.

Add near the top imports:

```ts
import { RATE_LIMIT_MESSAGE, checkLimit } from "../rate-limit";
```

`createDraft` already has `const user = await requireUser();` — after it add:

```ts
  const createGate = await checkLimit(user.id, "create");
  if (!createGate.ok) return fail(RATE_LIMIT_MESSAGE);
```

`joinDraft` — change `await requireUser();` to `const user = await requireUser();`, then after it:

```ts
  const gate = await checkLimit(user.id, "join");
  if (!gate.ok) return fail(RATE_LIMIT_MESSAGE);
```

`removeCaptainB` — change to `const user = await requireUser();`, then:

```ts
  const gate = await checkLimit(user.id, "manage");
  if (!gate.ok) return fail(RATE_LIMIT_MESSAGE);
```

`startDraft` — change to `const user = await requireUser();`, then:

```ts
  const gate = await checkLimit(user.id, "manage");
  if (!gate.ok) return fail(RATE_LIMIT_MESSAGE);
```

- [ ] **Step 3: Gate `players.ts`**

In `src/server/actions/players.ts` add the import:

```ts
import { RATE_LIMIT_MESSAGE, checkLimit } from "../rate-limit";
```

`addPlayer` — change `await requireUser();` to `const user = await requireUser();`, then after the existing name validation add:

```ts
  const gate = await checkLimit(user.id, "pool");
  if (!gate.ok) return fail(RATE_LIMIT_MESSAGE);
```

`removePlayer` — change to `const user = await requireUser();`, then:

```ts
  const gate = await checkLimit(user.id, "pool");
  if (!gate.ok) return fail(RATE_LIMIT_MESSAGE);
```

- [ ] **Step 4: Gate `picks.ts`**

In `src/server/actions/picks.ts` add the import:

```ts
import { RATE_LIMIT_MESSAGE, checkLimit } from "../rate-limit";
```

`makePick` — change `await requireUser();` to `const user = await requireUser();`, then:

```ts
  const gate = await checkLimit(user.id, "pick");
  if (!gate.ok) return fail(RATE_LIMIT_MESSAGE);
```

Leave `resolveTimeout` **unchanged** here — the timeout path is rate-limited at the tick route (Task 4), and this action is a harmless no-op when not expired.

- [ ] **Step 5: Gate `profile.ts`**

In `src/server/actions/profile.ts` add the import:

```ts
import { RATE_LIMIT_MESSAGE, checkLimit } from "../rate-limit";
```

`updateDisplayName` already has `const user = await requireUser();` — after the length validation add:

```ts
  const gate = await checkLimit(user.id, "profile");
  if (!gate.ok) return fail(RATE_LIMIT_MESSAGE);
```

- [ ] **Step 6: Typecheck and run existing tests**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; existing domain tests + the rate-limit test pass. (With Upstash unset, all gates no-op, so no behavior regression.)

- [ ] **Step 7: Commit**

```bash
git add src/server/actions/drafts.ts src/server/actions/players.ts src/server/actions/picks.ts src/server/actions/profile.ts
git commit -m "Rate-limit mutating server actions per user"
```

---

### Task 4: Enforce limit in the tick route handler

**Files:**
- Modify: `src/app/api/drafts/[id]/tick/route.ts`

**Interfaces:**
- Consumes: `checkLimit` from `src/server/rate-limit.ts`; `getCurrentUser` from `src/server/auth.ts`.
- Produces: `429` response with `Retry-After` header when over the limit.

- [ ] **Step 1: Read the Next route-handler guide**

Read the route handlers guide under `node_modules/next/dist/docs/` before editing (AGENTS.md).

- [ ] **Step 2: Add the gate**

In `src/app/api/drafts/[id]/tick/route.ts`, add the import:

```ts
import { checkLimit } from "@/server/rate-limit";
```

After the existing `if (!user) { return 401 }` block and before reading `params`, add:

```ts
  const gate = await checkLimit(user.id, "tick");
  if (!gate.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }
```

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/drafts/[id]/tick/route.ts
git commit -m "Rate-limit the turn-timeout tick route"
```

---

### Task 5: Join-race UX polish

**Files:**
- Modify: `src/components/draft/join-draft-button.tsx`

**Interfaces:**
- Consumes: `joinDraft` (returns `ActionResult`; on the failure branch `result.error` is the human-readable message from the RPC, e.g. `"this draft already has two captains"` or `"draft already started"`).
- Produces: on a "full" / "already started" failure, toast + redirect to `/dashboard`; other failures keep toast-only.

- [ ] **Step 1: Update the button to route the losing user out**

Rewrite `src/components/draft/join-draft-button.tsx`:

```tsx
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify the race path**

Simulate the loser: with a draft that already has Captain B, sign in as a third
account and open `/join/<token>`. The page's `has_second` branch already hides
the button; to exercise the button path, click Join in a stale tab opened before
B joined. Expected: red toast ("...already has two captains") + redirect to
`/dashboard`.

- [ ] **Step 4: Commit**

```bash
git add src/components/draft/join-draft-button.tsx
git commit -m "Redirect the losing joiner to the dashboard on a full draft"
```

---

## Self-Review

**Spec coverage:**
- Part A (rate limiting): Task 2 (helper + deps + env), Task 3 (server actions), Task 4 (tick route). All spec limits mapped to `WINDOWS`. ✓
- Part B (profiles RLS): Task 1. ✓
- Part C (join UX): Task 5. ✓
- Out-of-scope items (middleware-wide IP limit, `get_invite` limit) correctly omitted. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `checkLimit(userId, kind) → { ok, retryAfter }` and `LimitKind` literals (`tick|create|join|pool|pick|manage|profile`) are used identically across Tasks 2–4. `RATE_LIMIT_MESSAGE` reused verbatim. `WINDOWS` keys match `LimitKind` exactly. ✓
