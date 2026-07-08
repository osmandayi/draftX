# Kişisel Oyuncu Listesi (Saved Players) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Her kullanıcıya özel, tekilleştirilmiş bir "hazır oyuncu listesi" ekle; drafta ekleyince otomatik kaydolsun, ayrı `/players` sayfasından yönetilebilsin, lobide otomatik-tamamlama + çip panelinden hızlı eklenebilsin.

**Architecture:** Server-authoritative RPC deseni korunur. Yeni `saved_players` tablosu (RLS + case-insensitive unique index) SECURITY DEFINER RPC'lerle yazılır, RLS'li select ile okunur. Dedup/eşleşme mantığı pür bir modülde (`src/core/roster/match.ts`) toplanır ve hem UI hem test bunu kullanır. Otomatik kayıt, mevcut `add_player` RPC'sine aynı transaction içinde eklenir.

**Tech Stack:** Next.js 15 (App Router, Server Actions), Supabase (Postgres + RLS + RPC), React 19, base-ui/shadcn (`render` prop, `asChild` DEĞİL), Tailwind v4, Vitest.

## Global Constraints

- Next.js bu projede **kırıcı değişikliklerle** pinlenmiş — kod yazmadan önce `node_modules/next/dist/docs/` içindeki ilgili rehbere bak (AGENTS.md).
- shadcn/base-ui bileşenlerinde kompozisyon `render` prop'u ile yapılır, `asChild` ile DEĞİL.
- Migration'lar **elle** uygulanır (Supabase Dashboard → SQL Editor), dosya sırasına göre; koda deploy etmeden önce/ile. Otomatik CLI push yok.
- İsim sınırı: `trim` sonrası **1..60** karakter (mevcut `players.name` ile aynı).
- Dedup: `trim` + `lower(name)` (büyük/küçük harf duyarsız). İlk yazılan hâli saklanır.
- Yazmalar RPC'den, okumalar RLS'li `select`'ten (mevcut kod deseni).
- Rate limiting: yeni grup açma; mevcut `"pool"` grubunu kullan.
- `import type` ile tip çekerken `server-only` modülünden değer import etme (client bileşenlerinde patlar).

---

## File Structure

- `src/core/roster/match.ts` — **Create.** Pür, client+server güvenli: `SavedPlayer` tipi + `normalizeName`, `isNameInList`, `filterSuggestions`. Tek sorumluluk: isim eşleştirme/dedup.
- `src/core/roster/match.test.ts` — **Create.** Vitest birim testleri.
- `supabase/migrations/0008_saved_players.sql` — **Create.** Tablo, indeksler, RLS, `add_saved_player`, `remove_saved_player`, `add_player` değişikliği.
- `src/lib/database.types.ts` — **Modify.** `saved_players` tablosunu `Database["public"]["Tables"]`'a ekle.
- `src/server/repositories/saved-players.ts` — **Create.** `listSavedPlayers()`.
- `src/server/actions/saved-players.ts` — **Create.** `addSavedPlayer`, `removeSavedPlayer`.
- `src/components/saved-players-editor.tsx` — **Create.** `/players` sayfasının client editörü.
- `src/app/players/page.tsx` — **Create.** "Oyuncularım" sayfası.
- `src/components/layout/app-header.tsx` — **Modify.** Nav'a "Oyuncularım" linki.
- `src/app/drafts/[id]/room/page.tsx` — **Modify.** `listSavedPlayers()` çek, `DraftRoom`'a geç.
- `src/components/draft/draft-room.tsx` — **Modify.** `initialSavedPlayers` prop'unu `Lobby`'ye ilet.
- `src/components/draft/lobby.tsx` — **Modify.** `savedPlayers` prop'unu `PlayerPoolEditor`'a ilet.
- `src/components/draft/player-pool-editor.tsx` — **Modify.** Otomatik-tamamlama + çip paneli.

---

## Task 1: Roster eşleştirme/dedup helper (pür, TDD)

**Files:**
- Create: `src/core/roster/match.ts`
- Test: `src/core/roster/match.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `interface SavedPlayer { id: string; name: string; created_at: string }`
  - `normalizeName(name: string): string`
  - `isNameInList(name: string, list: { name: string }[]): boolean`
  - `filterSuggestions(query: string, saved: SavedPlayer[], poolNames: string[]): SavedPlayer[]`

- [ ] **Step 1: Write the failing test**

Create `src/core/roster/match.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  filterSuggestions,
  isNameInList,
  normalizeName,
  type SavedPlayer,
} from "./match";

const saved: SavedPlayer[] = [
  { id: "1", name: "Ahmet", created_at: "2026-01-01T00:00:00Z" },
  { id: "2", name: "Mehmet Yılmaz", created_at: "2026-01-02T00:00:00Z" },
  { id: "3", name: "can", created_at: "2026-01-03T00:00:00Z" },
];

describe("normalizeName", () => {
  it("trims and lowercases", () => {
    expect(normalizeName("  AHmet ")).toBe("ahmet");
  });
});

describe("isNameInList", () => {
  it("matches case- and whitespace-insensitively", () => {
    expect(isNameInList(" ahmet ", saved)).toBe(true);
    expect(isNameInList("CAN", saved)).toBe(true);
  });
  it("returns false for a new name", () => {
    expect(isNameInList("Zeynep", saved)).toBe(false);
  });
});

describe("filterSuggestions", () => {
  it("returns [] for an empty query", () => {
    expect(filterSuggestions("   ", saved, [])).toEqual([]);
  });
  it("matches by prefix, case-insensitively", () => {
    expect(filterSuggestions("me", saved, []).map((s) => s.id)).toEqual(["2"]);
  });
  it("excludes names already in the pool", () => {
    expect(filterSuggestions("ah", saved, ["ahmet"]).map((s) => s.id)).toEqual(
      [],
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/core/roster/match.test.ts`
Expected: FAIL — `Failed to resolve import "./match"` / module yok.

- [ ] **Step 3: Write minimal implementation**

Create `src/core/roster/match.ts`:

```ts
/** A saved player name owned by the current user. */
export interface SavedPlayer {
  id: string;
  name: string;
  created_at: string;
}

/** Canonical form for case- and whitespace-insensitive matching. */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** True if `name` already appears in `list` (case/whitespace-insensitive). */
export function isNameInList(name: string, list: { name: string }[]): boolean {
  const key = normalizeName(name);
  return list.some((entry) => normalizeName(entry.name) === key);
}

/**
 * Saved names whose normalized form starts with `query`, for the autocomplete,
 * excluding names already in the pool. Prefix match keeps the suggestion list
 * tight. Empty query returns [] (the browse panel handles "show all").
 */
export function filterSuggestions(
  query: string,
  saved: SavedPlayer[],
  poolNames: string[],
): SavedPlayer[] {
  const q = normalizeName(query);
  if (!q) return [];
  const pool = new Set(poolNames.map(normalizeName));
  return saved.filter(
    (entry) =>
      normalizeName(entry.name).startsWith(q) &&
      !pool.has(normalizeName(entry.name)),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/core/roster/match.test.ts`
Expected: PASS (6 test).

- [ ] **Step 5: Commit**

```bash
git add src/core/roster/match.ts src/core/roster/match.test.ts
git commit -m "Add roster name-matching helpers (normalize, dedup, suggestions)"
```

---

## Task 2: Migration 0008 — saved_players tablosu + RPC'ler + add_player otomatik kaydı

**Files:**
- Create: `supabase/migrations/0008_saved_players.sql`

**Interfaces:**
- Consumes: —
- Produces (DB yüzeyi): `saved_players` tablosu; RPC'ler `add_saved_player(p_name text) returns void`, `remove_saved_player(p_id uuid) returns void`; değişmiş `add_player(p_draft_id uuid, p_name text) returns public.players`.

> Not: SQL için otomatik test yok. Doğrulama: dosyayı Dashboard'da uygula + REST probe ile RPC varlığını kontrol et.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0008_saved_players.sql`:

```sql
-- =============================================================================
-- Per-user saved players ("Oyuncularım"). A personal, deduplicated roster of
-- player names. Auto-populated whenever a user adds a player to a draft pool,
-- and managed directly on the /players page.
--
-- Dedup is case- and whitespace-insensitive: a unique index on (user_id,
-- lower(name)) is the source of truth; the name is stored in its first-seen
-- casing. Writes go through SECURITY DEFINER RPCs; reads use an RLS select.
-- =============================================================================

create table if not exists public.saved_players (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);

-- Case-insensitive uniqueness per user (the dedup guarantee).
create unique index if not exists saved_players_user_name_idx
  on public.saved_players (user_id, lower(name));

-- Listing order.
create index if not exists saved_players_user_created_idx
  on public.saved_players (user_id, created_at);

alter table public.saved_players enable row level security;

-- Users can read only their own saved players.
drop policy if exists saved_players_select on public.saved_players;
create policy saved_players_select on public.saved_players
  for select using (user_id = auth.uid());

-- Add a name to the caller's roster; no-op if it already exists (any casing).
create or replace function public.add_saved_player(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if char_length(trim(p_name)) = 0 then
    raise exception 'name required';
  end if;
  if char_length(trim(p_name)) > 60 then
    raise exception 'name too long';
  end if;

  insert into public.saved_players (user_id, name)
  values (auth.uid(), trim(p_name))
  on conflict (user_id, lower(name)) do nothing;
end;
$$;

-- Remove one of the caller's saved players. Cannot touch other users' rows.
create or replace function public.remove_saved_player(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.saved_players
   where id = p_id and user_id = auth.uid();
end;
$$;

-- add_player: unchanged behaviour, plus auto-save the name to the caller's
-- roster in the same transaction. Return type is unchanged, so create or
-- replace is sufficient (no drop needed).
create or replace function public.add_player(p_draft_id uuid, p_name text)
returns public.players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.draft_status;
  v_count  int;
  v_row    public.players;
begin
  if not public.is_draft_member(p_draft_id) then
    raise exception 'not a member of this draft';
  end if;

  select status into v_status from public.drafts where id = p_draft_id for update;
  if v_status is null then raise exception 'draft not found'; end if;
  if v_status <> 'lobby' then raise exception 'draft already started'; end if;

  select count(*) into v_count from public.players where draft_id = p_draft_id;
  if v_count >= 12 then raise exception 'player pool is full (12)'; end if;
  if char_length(trim(p_name)) = 0 then raise exception 'name required'; end if;

  insert into public.players (draft_id, name, created_by)
  values (p_draft_id, trim(p_name), auth.uid())
  returning * into v_row;

  -- Auto-save to the adder's personal roster (deduped, best-effort).
  insert into public.saved_players (user_id, name)
  values (auth.uid(), trim(p_name))
  on conflict (user_id, lower(name)) do nothing;

  return v_row;
end;
$$;
```

- [ ] **Step 2: Apply the migration in Supabase**

Supabase Dashboard → SQL Editor → yukarıdaki dosyanın **tamamını** yapıştır ve çalıştır. (Proje ref: `qnmemxkzcdutnzuvdoku`.) Hatasız "Success" bekle.

- [ ] **Step 3: Verify the RPCs exist (non-destructive REST probe)**

`.env.local`'deki `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` ile:

```bash
URL="<NEXT_PUBLIC_SUPABASE_URL>"
KEY="<NEXT_PUBLIC_SUPABASE_ANON_KEY>"
curl -s -w "\nHTTP:%{http_code}\n" -X POST "$URL/rest/v1/rpc/add_saved_player" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -d '{"p_name":"__probe__"}'
```

Expected: RPC **var** — anon çağrıda `auth.uid()` null olduğundan not-null (user_id) ihlali ya da RLS kaynaklı bir hata döner (HTTP 400/401/403). **Kabul edilmeyen** çıktı: `PGRST202` "Could not find the function" (bu, migration'ın uygulanmadığını gösterir → Step 2'yi tekrar et). Fonksiyon bulundu mesajı yeterli; yan etki yok (anon insert başarısız olur).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0008_saved_players.sql
git commit -m "Add saved_players table, RPCs, and add_player auto-save (0008)"
```

---

## Task 3: Tipler + repository (listSavedPlayers)

**Files:**
- Modify: `src/lib/database.types.ts`
- Create: `src/server/repositories/saved-players.ts`

**Interfaces:**
- Consumes: `SavedPlayer` (Task 1, `@/core/roster/match`).
- Produces: `listSavedPlayers(): Promise<SavedPlayer[]>`.

- [ ] **Step 1a: Add the saved_players table type**

`src/lib/database.types.ts` içinde, `Database["public"]["Tables"]` nesnesine (mevcut `profiles` bloğunun hemen ardına, aynı stilde) ekle:

```ts
      saved_players: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          created_at?: string;
        };
      };
```

- [ ] **Step 1b: Register the new RPCs in the strict Functions map**

`Functions` bu projede **katı** tiplenmiştir; `supabase.rpc("add_saved_player", ...)` fonksiyon burada tanımlı değilse derleme hatası verir. `Functions` bloğuna (ör. `add_player` girdisinin ardına) ekle:

```ts
      add_saved_player: { Args: { p_name: string }; Returns: undefined };
      remove_saved_player: { Args: { p_id: string }; Returns: undefined };
```

- [ ] **Step 2: Create the repository**

Create `src/server/repositories/saved-players.ts`:

```ts
import "server-only";
import type { SavedPlayer } from "@/core/roster/match";
import { createSupabaseServerClient } from "../supabase/server";

/**
 * The current user's saved player names, oldest first. RLS scopes the rows to
 * auth.uid(), so no explicit user filter is needed here.
 */
export async function listSavedPlayers(): Promise<SavedPlayer[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("saved_players")
    .select("id, name, created_at")
    .order("created_at", { ascending: true });
  return data ?? [];
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: hata yok.

- [ ] **Step 4: Commit**

```bash
git add src/lib/database.types.ts src/server/repositories/saved-players.ts
git commit -m "Add saved_players types and listSavedPlayers repository"
```

---

## Task 4: Server action'ları (addSavedPlayer, removeSavedPlayer)

**Files:**
- Create: `src/server/actions/saved-players.ts`

**Interfaces:**
- Consumes: `requireUser`, `createSupabaseServerClient`, `ActionResult`/`fail`/`ok`/`errorMessage`, `checkLimit`/`RATE_LIMIT_MESSAGE` (mevcut).
- Produces: `addSavedPlayer(name: string): Promise<ActionResult>`, `removeSavedPlayer(id: string): Promise<ActionResult>`.

- [ ] **Step 1: Create the actions**

Create `src/server/actions/saved-players.ts` (mevcut `players.ts` desenini birebir izler):

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../auth";
import { createSupabaseServerClient } from "../supabase/server";
import { type ActionResult, errorMessage, fail, ok } from "./types";
import { RATE_LIMIT_MESSAGE, checkLimit } from "../rate-limit";

/** Add a name to the current user's personal roster (deduped server-side). */
export async function addSavedPlayer(name: string): Promise<ActionResult> {
  const user = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) return fail("Player name is required.");
  if (trimmed.length > 60) return fail("Player name is too long.");

  const gate = await checkLimit(user.id, "pool");
  if (!gate.ok) return fail(RATE_LIMIT_MESSAGE);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("add_saved_player", { p_name: trimmed });
  if (error) return fail(errorMessage(error));

  revalidatePath("/players");
  return ok(undefined);
}

/** Remove one saved player from the current user's roster. */
export async function removeSavedPlayer(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const gate = await checkLimit(user.id, "pool");
  if (!gate.ok) return fail(RATE_LIMIT_MESSAGE);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("remove_saved_player", { p_id: id });
  if (error) return fail(errorMessage(error));

  revalidatePath("/players");
  return ok(undefined);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: hata yok. (RPC adları Task 3 Step 1b'de `Functions`'a eklendiği için `supabase.rpc("add_saved_player" | "remove_saved_player", ...)` tanınır.)

- [ ] **Step 3: Commit**

```bash
git add src/server/actions/saved-players.ts
git commit -m "Add addSavedPlayer / removeSavedPlayer server actions"
```

---

## Task 5: /players yönetim sayfası + editör + nav linki

**Files:**
- Create: `src/components/saved-players-editor.tsx`
- Create: `src/app/players/page.tsx`
- Modify: `src/components/layout/app-header.tsx`

**Interfaces:**
- Consumes: `listSavedPlayers` (Task 3), `addSavedPlayer`/`removeSavedPlayer` (Task 4), `SavedPlayer`/`isNameInList` (Task 1).
- Produces: `SavedPlayersEditor({ players }: { players: SavedPlayer[] })`; route `/players`.

- [ ] **Step 1: Create the client editor**

Create `src/components/saved-players-editor.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  addSavedPlayer,
  removeSavedPlayer,
} from "@/server/actions/saved-players";
import { type SavedPlayer, isNameInList } from "@/core/roster/match";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Manage the current user's personal roster: add and remove saved names. */
export function SavedPlayersEditor({ players }: { players: SavedPlayer[] }) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (isNameInList(trimmed, players)) {
      toast.error("Bu isim listende zaten var.");
      return;
    }
    startTransition(async () => {
      const result = await addSavedPlayer(trimmed);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setName("");
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await removeSavedPlayer(id);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex gap-2"
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Oyuncu adı ekle"
          disabled={pending}
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Ekle</span>
        </Button>
      </form>

      {players.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 py-6 text-center text-sm text-muted-foreground">
          Henüz kayıtlı oyuncun yok. Bir draftta oyuncu ekledikçe burası dolar.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {players.map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm"
            >
              <span className="truncate">{player.name}</span>
              <button
                type="button"
                onClick={() => remove(player.id)}
                disabled={pending}
                aria-label={`${player.name} sil`}
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the page**

Create `src/app/players/page.tsx`:

```tsx
import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/server/auth";
import { listSavedPlayers } from "@/server/repositories/saved-players";
import { SavedPlayersEditor } from "@/components/saved-players-editor";

export const metadata: Metadata = { title: "Oyuncularım" };

export default async function PlayersPage() {
  await requireUser();
  const players = await listSavedPlayers();

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">Oyuncularım</h1>
          <p className="text-sm text-muted-foreground">
            Kayıtlı oyuncuların. Draftlarda buradan hızlıca ekleyebilirsin.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <SavedPlayersEditor players={players} />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Add the nav link**

`src/components/layout/app-header.tsx` içinde, `<nav>` bloğunda "History" butonundan hemen sonra ekle:

```tsx
          <Button variant="ghost" size="sm" render={<Link href="/players" />}>
            Oyuncularım
          </Button>
```

- [ ] **Step 4: Build + typecheck**

Run: `npm run lint && npm run build`
Expected: hata yok; `/players` route derlenir.

- [ ] **Step 5: Manual verification**

`npm run dev` → giriş yap → `/players`'a git. Bir isim ekle (listede belirmeli), aynı ismi farklı harf büyüklüğüyle ekle (toast "zaten var", mükerrer yok), sil (kaybolmalı). Sayfayı yenile → kalıcı.

- [ ] **Step 6: Commit**

```bash
git add src/components/saved-players-editor.tsx src/app/players/page.tsx src/components/layout/app-header.tsx
git commit -m "Add /players management page and nav link"
```

---

## Task 6: Lobi entegrasyonu — otomatik-tamamlama + çip paneli

**Files:**
- Modify: `src/app/drafts/[id]/room/page.tsx`
- Modify: `src/components/draft/draft-room.tsx`
- Modify: `src/components/draft/lobby.tsx`
- Modify: `src/components/draft/player-pool-editor.tsx`

**Interfaces:**
- Consumes: `listSavedPlayers` (Task 3), `SavedPlayer`/`filterSuggestions`/`isNameInList` (Task 1), mevcut `addPlayer`/`removePlayer`.
- Produces: `PlayerPoolEditor` artık `savedPlayers: SavedPlayer[]` prop'u alır; `DraftRoom` `initialSavedPlayers: SavedPlayer[]`, `Lobby` `savedPlayers: SavedPlayer[]` alır.

- [ ] **Step 1: Thread savedPlayers from the room page**

`src/app/drafts/[id]/room/page.tsx`:

Import ekle (mevcut importların yanına):

```tsx
import { listSavedPlayers } from "@/server/repositories/saved-players";
```

`const { draft, players } = result;`'tan sonra ekle:

```tsx
  const savedPlayers = await listSavedPlayers();
```

`<DraftRoom ... />`'a prop ekle (mevcut prop'ların yanına):

```tsx
          initialSavedPlayers={savedPlayers}
```

- [ ] **Step 2: Pass through DraftRoom**

`src/components/draft/draft-room.tsx`:

Import ekle:

```tsx
import type { SavedPlayer } from "@/core/roster/match";
```

Props tipine ekle (`initialCaptains: CaptainMap;`'ten sonra):

```tsx
  initialSavedPlayers: SavedPlayer[];
```

Fonksiyon parametre yıkımına `initialSavedPlayers` ekle, sonra lobby dalındaki `<Lobby ... />`'ye prop olarak ilet:

```tsx
        <Lobby
          draft={draft}
          isCreator={isCreator}
          inviteToken={inviteToken}
          captains={captains}
          savedPlayers={initialSavedPlayers}
        />
```

- [ ] **Step 3: Pass through Lobby**

`src/components/draft/lobby.tsx`:

Import ekle:

```tsx
import type { SavedPlayer } from "@/core/roster/match";
```

Props tipine ekle (`captains: CaptainMap;`'ten sonra):

```tsx
  savedPlayers,
```
ve tip bloğuna:
```tsx
  savedPlayers: SavedPlayer[];
```

`<PlayerPoolEditor ... />` çağrısını güncelle:

```tsx
          <PlayerPoolEditor
            draftId={draft.id}
            players={draft.players}
            savedPlayers={savedPlayers}
          />
```

- [ ] **Step 4: Rewrite PlayerPoolEditor with autocomplete + chip panel**

`src/components/draft/player-pool-editor.tsx`'i tümüyle değiştir:

```tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { addPlayer, removePlayer } from "@/server/actions/players";
import type { DraftPlayer } from "@/core/draft/types";
import {
  type SavedPlayer,
  filterSuggestions,
  isNameInList,
  normalizeName,
} from "@/core/roster/match";
import { DRAFTABLE_PLAYERS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Add / remove the 12 draftable player names while in the lobby. Names can be
 * typed (with autocomplete against the user's saved roster) or picked from the
 * "Listemden seç" chip panel. Adding auto-saves to the roster server-side; we
 * mirror that locally so the panel updates without a refetch.
 */
export function PlayerPoolEditor({
  draftId,
  players,
  savedPlayers,
}: {
  draftId: string;
  players: DraftPlayer[];
  savedPlayers: SavedPlayer[];
}) {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<SavedPlayer[]>(savedPlayers);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const refocus = useRef(false);

  const full = players.length >= DRAFTABLE_PLAYERS;
  const poolNames = players.map((p) => p.name);
  const suggestions = filterSuggestions(name, saved, poolNames);

  useEffect(() => {
    if (pending || !refocus.current) return;
    refocus.current = false;
    if (!full) inputRef.current?.focus();
  }, [pending, full]);

  function add(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setShowSuggestions(false);
    startTransition(async () => {
      const result = await addPlayer(draftId, trimmed);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setName("");
      refocus.current = true;
      // Auto-save happens server-side; mirror it so the chip panel reflects the
      // new name immediately (deduped by normalized name).
      setSaved((prev) =>
        isNameInList(trimmed, prev)
          ? prev
          : [
              ...prev,
              {
                id: `local-${normalizeName(trimmed)}`,
                name: trimmed,
                created_at: new Date().toISOString(),
              },
            ],
      );
    });
  }

  function remove(playerId: string) {
    startTransition(async () => {
      const result = await removePlayer(draftId, playerId);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Player pool</p>
        <span className="text-xs text-muted-foreground">
          {players.length}/{DRAFTABLE_PLAYERS}
        </span>
      </div>

      <div className="relative">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add(name);
          }}
          className="flex gap-2"
        >
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
            maxLength={60}
            placeholder={full ? "Pool is full" : "Add a player name"}
            disabled={full || pending}
          />
          <Button type="submit" disabled={full || pending} className="shrink-0">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add</span>
          </Button>
        </form>

        {showSuggestions && !full && suggestions.length > 0 ? (
          <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border/60 bg-popover p-1 shadow-md">
            {suggestions.slice(0, 8).map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  // Fire before input blur so the click registers.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(s.name)}
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {saved.length > 0 ? (
        <div className="rounded-lg border border-border/60">
          <button
            type="button"
            onClick={() => setBrowseOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-sm text-muted-foreground"
          >
            <span>Listemden seç ({saved.length})</span>
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                browseOpen && "rotate-180",
              )}
            />
          </button>
          {browseOpen ? (
            <div className="flex flex-wrap gap-2 px-3 pb-3">
              {saved.map((s) => {
                const inPool = isNameInList(s.name, players);
                const disabled = inPool || full || pending;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => add(s.name)}
                    disabled={disabled}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors",
                      disabled
                        ? "border-border/40 text-muted-foreground/50"
                        : "border-border/60 hover:border-primary/50 hover:bg-accent",
                    )}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {players.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 py-6 text-center text-sm text-muted-foreground">
          Add {DRAFTABLE_PLAYERS} players to start the draft.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {players.map((player, i) => (
            <li
              key={player.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="truncate">{player.name}</span>
              </span>
              <button
                type="button"
                onClick={() => remove(player.id)}
                disabled={pending}
                aria-label={`Remove ${player.name}`}
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Build + typecheck**

Run: `npm run lint && npm run build`
Expected: hata yok.

- [ ] **Step 6: Manual verification (end-to-end)**

`npm run dev` → bir draft odasına (lobby) gir:
1. İsim yaz → kayıtlı listeden eşleşen öneriler açılır; birini tıkla → havuza eklenir, input temizlenir.
2. "Listemden seç" panelini aç → çiplere tıkla → havuza eklenir; havuzdaki isimlerin çipi soluk/pasif.
3. Havuz 12 olunca input ve tüm çipler pasif.
4. `/players`'a git → lobide eklediğin isimlerin otomatik kaydedildiğini doğrula.

- [ ] **Step 7: Commit**

```bash
git add src/app/drafts/[id]/room/page.tsx src/components/draft/draft-room.tsx src/components/draft/lobby.tsx src/components/draft/player-pool-editor.tsx
git commit -m "Wire saved-player autocomplete and chip panel into the lobby"
```

---

## Self-Review Notları

- **Spec kapsamı:** Tablo/dedup (Task 2), otomatik kayıt (Task 2 `add_player`), RPC'ler (Task 2), action'lar (Task 4), repo/tipler (Task 3), `/players` sayfası + yönetim (Task 5), lobi otomatik-tamamlama + çip paneli (Task 6), nav linki (Task 5). Tümü karşılandı.
- **Case-insensitive dedup:** SQL (unique index + `on conflict (user_id, lower(name))`) ve UI (`normalizeName`/`isNameInList`) paralel; ikisi de `trim`+`lower`.
- **Tip tutarlılığı:** `SavedPlayer` tek kaynak (`@/core/roster/match`); repo `import type` ile çeker (server-only sızmaz), client bileşenleri değer+tip aynı pür modülden alır. `add_player` dönüş tipi (`public.players`) değişmedi → `create or replace` yeterli.
- **Kapsam dışı korundu:** Havuz-içi mükerrer engeli yok (çip pasifleştirme sadece UI), rename yok, paylaşım yok.
- **Test gerçekçiliği:** Pür mantık (Task 1) vitest ile TDD; SQL/action/bileşen katmanı repo desenine uygun olarak `lint`+`build`+manuel doğrulama ile.
