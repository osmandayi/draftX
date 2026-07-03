-- =============================================================================
-- Captain Draft — initial schema
-- Server-authoritative draft engine. All state transitions go through
-- SECURITY DEFINER RPCs so validation cannot be bypassed by direct table
-- writes. RLS restricts reads to draft members.
-- =============================================================================

-- gen_random_uuid() is core Postgres (13+), so no extension is required.

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'draft_status') then
    create type public.draft_status as enum ('lobby', 'active', 'completed');
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- profiles: mirrors auth.users, populated by a signup trigger
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- drafts
-- -----------------------------------------------------------------------------
create table if not exists public.drafts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(trim(name)) between 1 and 80),
  creator_id      uuid not null references auth.users (id) on delete cascade,
  status          public.draft_status not null default 'lobby',
  invite_token    text not null unique default replace(gen_random_uuid()::text, '-', ''),
  captain_a       uuid references auth.users (id),
  captain_b       uuid references auth.users (id),
  current_captain uuid references auth.users (id),
  turn_index      int  not null default 0,
  turn_deadline   timestamptz,
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz
);

create index if not exists drafts_creator_idx on public.drafts (creator_id);
create index if not exists drafts_captain_a_idx on public.drafts (captain_a);
create index if not exists drafts_captain_b_idx on public.drafts (captain_b);

-- -----------------------------------------------------------------------------
-- players (draftable pool + draft results)
-- -----------------------------------------------------------------------------
create table if not exists public.players (
  id          uuid primary key default gen_random_uuid(),
  draft_id    uuid not null references public.drafts (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 60),
  drafted_by  uuid references auth.users (id),
  pick_number int,
  created_by  uuid not null references auth.users (id),
  created_at  timestamptz not null default now()
);

create index if not exists players_draft_idx on public.players (draft_id, created_at);

-- -----------------------------------------------------------------------------
-- picks: immutable audit log of draft order
-- -----------------------------------------------------------------------------
create table if not exists public.picks (
  id          uuid primary key default gen_random_uuid(),
  draft_id    uuid not null references public.drafts (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  captain_id  uuid not null references auth.users (id),
  pick_number int  not null,
  was_auto    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (draft_id, pick_number)
);

create index if not exists picks_draft_idx on public.picks (draft_id, pick_number);

-- =============================================================================
-- Signup trigger: create a profile row for every new auth user
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- Membership helper (SECURITY DEFINER to bypass RLS inside policies)
-- =============================================================================
create or replace function public.is_draft_member(p_draft_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.drafts d
    where d.id = p_draft_id
      and (d.creator_id = auth.uid()
        or d.captain_a = auth.uid()
        or d.captain_b = auth.uid())
  );
$$;

-- =============================================================================
-- Draft engine (all SECURITY DEFINER)
-- =============================================================================

-- Fixed schedule shared with src/lib/constants.ts. Index i (1-based) is the
-- captain slot on the clock for turn_index = i-1. Turn index 11 is the final
-- auto-assigned pick, always Captain A.
create or replace function public.draft_schedule_slot(p_turn_index int)
returns text
language sql
immutable
as $$
  select case
    when p_turn_index = 11 then 'A'
    else (array['A','B','B','A','A','B','B','A','A','B','B'])[p_turn_index + 1]
  end;
$$;

-- Internal: apply a validated pick and advance / complete the draft.
-- Assumes the caller holds a FOR UPDATE lock on the draft row and has already
-- validated turn ownership + player availability.
create or replace function public.draft_apply_pick(
  p_draft_id   uuid,
  p_player_id  uuid,
  p_captain_id uuid,
  p_was_auto   boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_captain_a   uuid;
  v_captain_b   uuid;
  v_turn_index  int;
  v_pick_number int;
  v_next        int;
  v_slot        text;
  v_next_cap    uuid;
  v_last_player uuid;
begin
  select captain_a, captain_b, turn_index
    into v_captain_a, v_captain_b, v_turn_index
    from public.drafts where id = p_draft_id;

  v_pick_number := v_turn_index + 1;

  update public.players
     set drafted_by = p_captain_id, pick_number = v_pick_number
   where id = p_player_id;

  insert into public.picks (draft_id, player_id, captain_id, pick_number, was_auto)
  values (p_draft_id, p_player_id, p_captain_id, v_pick_number, p_was_auto);

  v_next := v_turn_index + 1;

  if v_next >= 11 then
    -- Final pick: auto-assign the single remaining player to Captain A.
    select id into v_last_player
      from public.players
     where draft_id = p_draft_id and drafted_by is null
     order by created_at, id
     limit 1;

    if v_last_player is not null then
      update public.players
         set drafted_by = v_captain_a, pick_number = 12
       where id = v_last_player;

      insert into public.picks (draft_id, player_id, captain_id, pick_number, was_auto)
      values (p_draft_id, v_last_player, v_captain_a, 12, true);
    end if;

    update public.drafts
       set status = 'completed',
           current_captain = null,
           turn_index = 12,
           turn_deadline = null,
           completed_at = now()
     where id = p_draft_id;
  else
    v_slot := public.draft_schedule_slot(v_next);
    v_next_cap := case when v_slot = 'A' then v_captain_a else v_captain_b end;

    update public.drafts
       set turn_index = v_next,
           current_captain = v_next_cap,
           turn_deadline = now() + interval '120 seconds'
     where id = p_draft_id;
  end if;
end;
$$;

-- Public: create draft happens via direct insert (RLS guarded). Add a player.
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

  return v_row;
end;
$$;

create or replace function public.remove_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft_id uuid;
  v_status   public.draft_status;
begin
  select draft_id into v_draft_id from public.players where id = p_player_id;
  if v_draft_id is null then raise exception 'player not found'; end if;
  if not public.is_draft_member(v_draft_id) then
    raise exception 'not a member of this draft';
  end if;

  select status into v_status from public.drafts where id = v_draft_id for update;
  if v_status <> 'lobby' then raise exception 'draft already started'; end if;

  delete from public.players where id = p_player_id;
end;
$$;

-- Public: join a draft as Captain B using an invite token.
create or replace function public.join_draft(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.drafts;
begin
  select * into v_draft from public.drafts where invite_token = p_token for update;
  if v_draft.id is null then raise exception 'invalid invite'; end if;
  if v_draft.status <> 'lobby' then raise exception 'draft already started'; end if;

  if v_draft.captain_a = auth.uid() then
    raise exception 'you created this draft';
  end if;

  if v_draft.captain_b is not null then
    if v_draft.captain_b = auth.uid() then
      return v_draft.id; -- already joined, idempotent
    end if;
    raise exception 'this draft already has two captains';
  end if;

  update public.drafts set captain_b = auth.uid() where id = v_draft.id;
  return v_draft.id;
end;
$$;

-- Public: read minimal invite info (for the join page, non-members allowed).
create or replace function public.get_invite(p_token text)
returns table (
  id           uuid,
  name         text,
  status       public.draft_status,
  captain_name text,
  has_second   boolean,
  player_count bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select d.id,
         d.name,
         d.status,
         p.display_name,
         d.captain_b is not null,
         (select count(*) from public.players pl where pl.draft_id = d.id)
    from public.drafts d
    left join public.profiles p on p.id = d.captain_a
   where d.invite_token = p_token;
$$;

-- Public: start the draft (creator only).
create or replace function public.start_draft(p_draft_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.drafts;
  v_count int;
begin
  select * into v_draft from public.drafts where id = p_draft_id for update;
  if v_draft.id is null then raise exception 'draft not found'; end if;
  if v_draft.creator_id <> auth.uid() then
    raise exception 'only the creator can start the draft';
  end if;
  if v_draft.status <> 'lobby' then raise exception 'draft already started'; end if;
  if v_draft.captain_a is null or v_draft.captain_b is null then
    raise exception 'two captains are required';
  end if;

  select count(*) into v_count from public.players where draft_id = p_draft_id;
  if v_count <> 12 then raise exception 'exactly 12 players are required'; end if;

  update public.drafts
     set status = 'active',
         turn_index = 0,
         current_captain = v_draft.captain_a,
         turn_deadline = now() + interval '120 seconds',
         started_at = now()
   where id = p_draft_id;
end;
$$;

-- Public: make a manual pick (must be the caller's turn).
create or replace function public.make_pick(p_draft_id uuid, p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft  public.drafts;
  v_player public.players;
begin
  select * into v_draft from public.drafts where id = p_draft_id for update;
  if v_draft.id is null then raise exception 'draft not found'; end if;
  if v_draft.status <> 'active' then raise exception 'draft is not active'; end if;
  if v_draft.current_captain <> auth.uid() then
    raise exception 'it is not your turn';
  end if;

  select * into v_player from public.players
   where id = p_player_id and draft_id = p_draft_id for update;
  if v_player.id is null then raise exception 'player not found'; end if;
  if v_player.drafted_by is not null then
    raise exception 'player already drafted';
  end if;

  perform public.draft_apply_pick(p_draft_id, p_player_id, v_draft.current_captain, false);
end;
$$;

-- Public: resolve an expired turn by auto-picking. Idempotent under races:
-- no-op if the turn is not actually expired (e.g. another client already
-- advanced it).
create or replace function public.resolve_timeout(p_draft_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft     public.drafts;
  v_player_id uuid;
begin
  select * into v_draft from public.drafts where id = p_draft_id for update;
  if v_draft.id is null then raise exception 'draft not found'; end if;
  if auth.uid() not in (v_draft.captain_a, v_draft.captain_b) then
    raise exception 'not a member of this draft';
  end if;
  if v_draft.status <> 'active' then return; end if;
  if v_draft.turn_deadline is null or now() < v_draft.turn_deadline then
    return; -- not expired; another client may have advanced already
  end if;

  select id into v_player_id
    from public.players
   where draft_id = p_draft_id and drafted_by is null
   order by created_at, id
   limit 1;
  if v_player_id is null then return; end if;

  perform public.draft_apply_pick(p_draft_id, v_player_id, v_draft.current_captain, true);
end;
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles enable row level security;
alter table public.drafts   enable row level security;
alter table public.players  enable row level security;
alter table public.picks    enable row level security;

-- profiles: world-readable (for displaying captain names/avatars), self-writable
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- drafts: readable by members; insert only as yourself; state changes via RPC
drop policy if exists drafts_select_member on public.drafts;
create policy drafts_select_member on public.drafts
  for select using (
    creator_id = auth.uid()
    or captain_a = auth.uid()
    or captain_b = auth.uid()
  );

drop policy if exists drafts_insert_self on public.drafts;
create policy drafts_insert_self on public.drafts
  for insert with check (
    creator_id = auth.uid() and captain_a = auth.uid()
  );
-- (no UPDATE/DELETE policies: all mutations go through SECURITY DEFINER RPCs)

-- players: readable by draft members; writes go through RPCs
drop policy if exists players_select_member on public.players;
create policy players_select_member on public.players
  for select using (public.is_draft_member(draft_id));

-- picks: readable by draft members; inserts go through RPCs
drop policy if exists picks_select_member on public.picks;
create policy picks_select_member on public.picks
  for select using (public.is_draft_member(draft_id));

-- =============================================================================
-- Realtime: broadcast draft + player row changes to subscribed clients
-- =============================================================================
alter publication supabase_realtime add table public.drafts;
alter publication supabase_realtime add table public.players;
