# Abuse Hardening — Rate Limiting, profiles RLS, Join UX

**Date:** 2026-07-04
**Status:** Approved (brainstorming) → ready for planning

## Context

Captain Draft is a two-captain (A + B) real-time draft app on Next.js 15 +
Supabase. State transitions already go through `SECURITY DEFINER` Postgres RPCs
with RLS. This spec covers three abuse/hardening concerns raised for the app:

1. **Multiple people joining via the invite link** — investigated; **already
   safe**. `join_draft` (`0001_init.sql:282`) uses `SELECT ... FOR UPDATE`, so
   concurrent joiners are serialized: first becomes Captain B, the rest get
   `"this draft already has two captains"`; the same user re-joining is
   idempotent. No backend change needed — only a UX polish (part C).
2. **Sensitive data audit** — mostly clean. `profiles` stores only
   `display_name` + `avatar_url` (no email/tokens/passwords). No `service_role`
   key anywhere; only the public `NEXT_PUBLIC_ANON_KEY`. `.env*` is gitignored
   and untracked. One gap: `profiles` is world-readable (part B).
3. **Rate limiting** — none exists. Add it (part A).

## Out of scope (YAGNI)

- Middleware-wide IP rate limiting (adds latency to every request).
- Separate limit for `get_invite` — protected by 128-bit token entropy.
- Any change to the draft engine RPCs.

---

## Part A — Rate limiting (Upstash Redis)

Chosen approach: Upstash Redis via `@upstash/ratelimit` — works across
serverless instances, standard for Vercel deployments.

### Dependencies & env

- Add deps: `@upstash/ratelimit`, `@upstash/redis`.
- New env vars: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- Add both to `.env.example` (commented, with a note they are optional in dev).

### New module: `src/server/rate-limit.ts`

- Lazily construct a single `Redis` client from env.
- Define named sliding-window limiters keyed by an "action kind".
- Export `checkLimit(userId: string, kind: LimitKind): Promise<{ ok: boolean; retryAfter: number }>`.
- **Graceful fallback:** if the Upstash env vars are absent, `checkLimit`
  returns `{ ok: true }` (no-op) so local dev and CI are unaffected.
- Key format: `rl:{kind}:{userId}`. All mutating server actions call
  `requireUser`, so the authenticated user id is always available as the key.

### Limits (per user)

| Surface | kind | Limit |
|---|---|---|
| `POST /api/drafts/[id]/tick` | `tick` | 12 / 10s |
| `createDraft` | `create` | 5 / min |
| `joinDraft` | `join` | 10 / min |
| `addPlayer` / `removePlayer` | `pool` | 40 / min |
| `makePick` | `pick` | 30 / min |
| `startDraft` / `removeCaptainB` | `manage` | 10 / min |
| profile update | `profile` | 10 / min |

### Enforcement

- **Server actions** (`drafts.ts`, `players.ts`, `picks.ts`, `profile.ts`):
  after `requireUser()`, call `checkLimit(user.id, kind)`. If `!ok`, return
  `fail("Çok fazla istek, biraz yavaşla. Lütfen birkaç saniye bekle.")`.
  Some actions currently discard the user (`await requireUser()`); capture it
  as `const user = await requireUser()` to key the limit.
- **Tick route** (`app/api/drafts/[id]/tick/route.ts`): after auth, call
  `checkLimit(user.id, "tick")`. If `!ok`, return
  `NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(retryAfter) } })`.

### Testing

- Unit-test `checkLimit`'s no-op fallback path (env absent → always ok).
- Limiter threshold behavior with Upstash is integration-level; not unit-tested
  here (would require a live Redis). Keep the module thin so the no-op path is
  the only branch worth unit-testing.

---

## Part B — Restrict `profiles` RLS

Replace the world-readable select policy with self-or-co-member visibility.

### Migration: `supabase/migrations/0006_profiles_rls.sql`

```sql
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

### Why this is safe

- `draft-room.tsx` (browser) and `getProfilesByIds` (server, room + history)
  only ever read the two captains of a draft the viewer belongs to → allowed as
  co-members.
- The join/invite preview reads Captain A's name via `get_invite`, which is
  `SECURITY DEFINER` and bypasses RLS → unaffected.
- `getProfile(self)` reads the caller's own row → allowed by `id = auth.uid()`.

### Verification

Manually confirm after the migration: room shows both captain names, history
shows both, and the invite page still shows Captain A's name to a
not-yet-joined visitor.

---

## Part C — Join UX polish

Backend is already race-safe; improve feedback for the losing/late second user.

- `join-draft-button.tsx`: on a failed `joinDraft` whose error indicates the
  draft is full or started, show the toast and redirect to `/dashboard` (so a
  user who lost the race isn't stuck on a dead join screen). Generic errors keep
  the existing toast-only behavior.
- `join/[token]/page.tsx`: keep the existing `has_second` / non-`lobby`
  branches; tighten copy so "already has two captains" / "already started" read
  clearly. No logic change.

---

## Files touched (summary)

- **New:** `src/server/rate-limit.ts`, `supabase/migrations/0006_profiles_rls.sql`
- **Edit:** `src/server/actions/drafts.ts`, `players.ts`, `picks.ts`,
  `profile.ts`; `src/app/api/drafts/[id]/tick/route.ts`;
  `src/components/draft/join-draft-button.tsx`; `join/[token]/page.tsx`;
  `.env.example`; `package.json` (deps).
- **Tests:** rate-limit no-op fallback unit test.

## Implementation notes

- Per AGENTS.md, read the relevant guide under `node_modules/next/dist/docs/`
  before editing route handlers / server actions in this customized Next build.
- Ship in the order B → A → C (RLS is independent and low-risk; rate limiting is
  the bulk; UX last).
