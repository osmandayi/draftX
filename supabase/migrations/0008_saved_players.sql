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
