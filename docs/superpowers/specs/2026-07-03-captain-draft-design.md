# Captain Draft — Design Spec

Date: 2026-07-03
Status: Approved

## 1. Purpose

A mobile-first web app where two captains draft a 14-player football (soccer)
squad in real time. Two captains + 12 draftable players. Server-authoritative
draft engine with a 120-second per-turn countdown and auto-pick on timeout.

## 2. Tech Stack

- Next.js 15 (App Router), TypeScript (strict)
- TailwindCSS + shadcn/ui (mobile-first)
- Supabase: Postgres, Auth (Google OAuth), Realtime
- `@supabase/ssr` for cookie-based auth in RSC/Server Actions
- Vitest for pure domain unit tests

## 3. Draft Rules (authoritative)

- 14 total: 2 captains + 12 draftable players.
- Pick schedule (11 explicit picks), captain on the clock per index:
  `[A, B, B, A, A, B, B, A, A, B, B]`
- After the 11 explicit picks, one player remains → auto-assigned to Captain A.
- Result: each team = captain + 6 players = 7.
- Every turn: 120-second countdown (`turn_deadline` timestamp in DB).
- On timeout: engine auto-picks the next available player for the captain on
  the clock (draft never stalls). Recorded with `was_auto = true`.

## 4. Architecture — Server-Authoritative

The database is the single source of truth. Clients never mutate draft state
directly. A pick is valid only if a Postgres `SECURITY DEFINER` RPC confirms:
it is the caller's turn, the player is available, and (for timeout resolution)
`now() >= turn_deadline`. Supabase Realtime broadcasts row changes to both
clients.

Layers (clean architecture):

- **core/** — pure domain logic, no I/O: `schedule.ts`, `rules.ts`, `types.ts`.
  Fully unit-tested.
- **server/** — application layer: Server Actions, Supabase clients,
  repositories (DB access wrappers).
- **components/**, **hooks/** — presentation: realtime subscription + countdown.

### Pick flow

click player → `makePick` Server Action → RPC `make_pick(draft_id, player_id)`
validates + inserts pick + sets `players.drafted_by` + advances `turn_index` +
sets new `turn_deadline` → Realtime pushes updated `drafts` + `players` rows →
both UIs update, timer resets, turn switches. On completion the RPC sets
`status='completed'` and auto-assigns the last player.

### Timer expiry

`turn_deadline` is an absolute timestamp. `useCountdown` renders remaining time
from it (no reliance on synced local clocks). When it hits zero, the active
client calls `resolveTimeout` Server Action → RPC `resolve_timeout` which
re-checks `now() >= turn_deadline` before auto-picking, so it stays
authoritative even if multiple clients fire it.

## 5. Folder Structure

```
src/
  app/
    (marketing)/page.tsx            # Landing
    auth/callback/route.ts          # OAuth callback
    auth/signout/route.ts
    dashboard/page.tsx              # user's drafts
    drafts/new/page.tsx             # Create Draft
    join/[token]/page.tsx           # Join via invite
    drafts/[id]/room/page.tsx       # Draft Room (realtime)
    history/page.tsx                # History list
    history/[id]/page.tsx           # completed draft detail
    profile/page.tsx                # Profile
    api/drafts/[id]/tick/route.ts   # optional timeout resolver endpoint
  core/
    draft/schedule.ts               # pick-order logic (pure)
    draft/rules.ts                  # validation + team assembly (pure)
    draft/types.ts                  # domain types
    draft/*.test.ts                 # Vitest unit tests
  server/
    actions/                        # Server Actions
    supabase/server.ts | browser.ts | middleware.ts
    repositories/                   # DB access wrappers
  components/{ui,draft,layout}/
  hooks/{use-draft-realtime,use-countdown}.ts
  lib/{constants,utils}.ts
supabase/
  migrations/0001_init.sql          # tables, RLS, RPCs, realtime publication
  seed.sql
```

## 6. Database Schema

- **profiles**(id PK→auth.users, display_name, avatar_url, created_at)
- **drafts**(id, name, creator_id, status `lobby|active|completed`,
  invite_token unique, captain_a, captain_b, current_captain, turn_index,
  turn_deadline, created_at, started_at, completed_at)
- **players**(id, draft_id, name, drafted_by nullable, pick_number nullable,
  created_by, created_at)
- **picks**(id, draft_id, player_id, captain_id, pick_number, was_auto,
  created_at) — immutable audit log of pick order.

Final teams derived from `players.drafted_by` + captain ids; the `picks` log
preserves full pick order + timestamps + auto flags.

### RLS

- A user may read/write a draft row only if they are `creator_id`,
  `captain_a`, or `captain_b`.
- `players` / `picks` visible + insertable only to members of the parent draft.
- State transitions (`start_draft`, `join_draft`, `make_pick`,
  `resolve_timeout`) go through `SECURITY DEFINER` RPCs so validation cannot be
  bypassed by direct table writes.

## 7. Realtime

Room subscribes to Postgres changes:
- `drafts` filtered by `id=eq.<draftId>` → turn/deadline/status.
- `players` filtered by `draft_id=eq.<draftId>` → who got drafted.

`use-draft-realtime` merges these into local state; `use-countdown` derives
seconds-left from `turn_deadline`.

## 8. Membership & Invites

- A draft has exactly 2 captains. Creator becomes `captain_a`.
- Creator generates an invite link (`/join/<invite_token>`).
- The second authenticated user to join becomes `captain_b` (via `join_draft`
  RPC; rejects if already full or if the user is already captain_a).
- Both captains may add player names while `status='lobby'`.
- Only the creator can `start_draft` (requires 2 captains + exactly 12
  players + still in lobby). Start sets `status='active'`, `current_captain`,
  `turn_index=0`, `turn_deadline=now()+120s`.

## 9. Pages

- **Landing** — value prop + "Login with Google".
- **Dashboard** — list of the user's drafts by status; create button.
- **Create Draft** — name the draft → creates row → redirect to room lobby.
- **Join** — `/join/[token]`: shows draft, "Join as Captain B".
- **Draft Room** — lobby (add players, invite link, start) and live draft
  (board, player pool, timer, both teams) depending on status.
- **History** — completed drafts; detail shows final teams + full pick order.
- **Profile** — display name, avatar, sign out.

## 10. Testing

- `schedule.ts`: correct captain per turn index; total picks; final auto-assign
  to A; team sizes 7/7.
- `rules.ts`: pick validation (wrong turn, taken player, not a member),
  completion detection, team assembly.

## 11. Out of Scope (YAGNI)

Spectators, chat, more than 2 captains, configurable squad sizes, player
stats/positions, mobile native app, email invites. Squad is fixed at 14 with
the specified schedule.
