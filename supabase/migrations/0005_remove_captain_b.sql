-- =============================================================================
-- Let the creator remove Captain B while still in the lobby (e.g. the wrong
-- person joined). Clears captain_b so a new second captain can join via the
-- invite link. SECURITY DEFINER + creator/lobby checks so it can't be abused.
-- =============================================================================

create or replace function public.remove_captain_b(p_draft_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.drafts;
begin
  select * into v_draft from public.drafts where id = p_draft_id for update;
  if v_draft.id is null then raise exception 'draft not found'; end if;
  if v_draft.creator_id <> auth.uid() then
    raise exception 'only the creator can remove a captain';
  end if;
  if v_draft.status <> 'lobby' then raise exception 'draft already started'; end if;

  update public.drafts set captain_b = null where id = p_draft_id;
end;
$$;

-- PostgREST picks up the new function on the next schema reload.
notify pgrst, 'reload schema';
