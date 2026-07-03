# Captain Draft ⚽

A mobile-first web app where **two captains draft a 14-player football squad in
real time**. 2 captains + 12 draftable players, a fixed pick order, and a
120-second shot clock with auto-pick on timeout. Built with a
**server-authoritative** draft engine so state can't be forged or desynced.

## Stack

- **Next.js 15** (App Router) + **TypeScript** (strict)
- **TailwindCSS v4** + **shadcn/ui** (mobile-first)
- **Supabase**: Postgres, Auth (Google OAuth), Realtime
- **Vitest** for pure domain unit tests

## How the draft works

- 14 total: 2 captains + 12 players.
- Pick order (captain on the clock per turn): `A, B, B, A, A, B, B, A, A, B, B`
  then the final remaining player is auto-assigned to Captain A.
- Each team ends with 7 (captain + 6).
- Every turn has a 120s deadline (`turn_deadline`). When it expires the engine
  auto-picks the next available player. All picks go through
  `SECURITY DEFINER` Postgres RPCs and broadcast over Supabase Realtime.

## Architecture

```
src/
  core/draft/        Pure domain logic (schedule, rules, types) + Vitest tests
  server/            Supabase clients, repositories, Server Actions, auth
  hooks/             use-draft-realtime, use-countdown
  components/        ui/ (shadcn), draft/ (room), layout/
  app/               Landing, dashboard, drafts/new, join/[token],
                     drafts/[id]/room, history, profile, auth routes, api
supabase/
  migrations/0001_init.sql   Tables, RLS, RPC engine, realtime publication
```

The database is the single source of truth. Clients call Server Actions →
RPCs validate turn ownership + availability atomically → Realtime pushes the
new rows to both captains.

## Setup

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run `supabase/migrations/0001_init.sql`.
3. In **Authentication → Providers → Google**, enable Google and add your
   Google OAuth **Client ID / Secret** (create them in the Google Cloud
   console). Set the authorized redirect URL to:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. In **Authentication → URL Configuration**, add your site URL
   (`http://localhost:3000`) and redirect URL `http://localhost:3000/**`.

### 3. Environment

```bash
cp .env.example .env.local
```

Fill in from **Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### 4. Run

```bash
npm run dev      # http://localhost:3000
npm test         # unit tests for the draft engine
npm run build    # production build
```

## Playing a full draft

1. Sign in with Google → **New draft**.
2. Copy the invite link, open it in a second browser/profile, sign in as a
   different Google account, and **Join as Captain B**.
3. Either captain adds 12 player names in the lobby.
4. The creator presses **Start** — the live room opens for both captains.
5. Take turns picking before the 120s clock runs out; the final player is
   auto-assigned. Results + full pick order are saved and viewable under
   **History**.

## What gets saved

Every draft persists: the draft row + timestamps (`started_at`,
`completed_at`), both captains, the immutable `picks` log (pick order, which
captain, auto-pick flag), and the final teams (`players.drafted_by` /
`pick_number`).
