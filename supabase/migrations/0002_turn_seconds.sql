-- =============================================================================
-- Configurable per-turn timer (20–120s), server-authoritative.
-- The creator picks the duration when starting; it is stored on the draft and
-- used by the engine for every turn deadline (manual picks + timeouts).
-- =============================================================================

alter table public.drafts
  add column if not exists turn_seconds int not null default 120
  check (turn_seconds between 20 and 120);

-- The signature changes (adds p_turn_seconds), so drop the old 1-arg version to
-- avoid an ambiguous overload before recreating.
drop function if exists public.start_draft(uuid);

create or replace function public.start_draft(
  p_draft_id uuid,
  p_turn_seconds int default 120
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.drafts;
  v_count int;
  v_secs  int;
begin
  -- Clamp defensively; a check constraint also guards the column.
  v_secs := least(120, greatest(20, coalesce(p_turn_seconds, 120)));

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
         turn_seconds = v_secs,
         current_captain = v_draft.captain_a,
         turn_deadline = now() + make_interval(secs => v_secs),
         started_at = now()
   where id = p_draft_id;
end;
$$;

-- Recreate the pick engine so the next turn deadline uses the draft's own
-- turn_seconds instead of a hardcoded 120.
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
  v_captain_a    uuid;
  v_captain_b    uuid;
  v_turn_index   int;
  v_turn_seconds int;
  v_pick_number  int;
  v_next         int;
  v_slot         text;
  v_next_cap     uuid;
  v_last_player  uuid;
begin
  select captain_a, captain_b, turn_index, turn_seconds
    into v_captain_a, v_captain_b, v_turn_index, v_turn_seconds
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
           turn_deadline = now() + make_interval(secs => v_turn_seconds)
     where id = p_draft_id;
  end if;
end;
$$;
