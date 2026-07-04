-- =============================================================================
-- join_draft: return a machine-readable outcome code instead of relying on
-- English exception text for expected control-flow cases. The app switches on
-- `code` (stable) and localizes the user-facing message itself, so rewording
-- or translating messages can never break the join-race redirect logic.
--
-- Returns jsonb: { "code": <text>, "draft_id": <uuid|null> }
--   'joined'          -> newly joined as Captain B (draft_id set)
--   'already_joined'  -> caller was already Captain B, idempotent (draft_id set)
--   'invalid'         -> no draft for this token (draft_id null)
--   'not_lobby'       -> draft already started/completed (draft_id set)
--   'is_creator'      -> caller created this draft (draft_id set)
--   'full'            -> draft already has a different Captain B (draft_id set)
--
-- Return type changed from uuid, so the old function must be dropped first.
-- =============================================================================
drop function if exists public.join_draft(text);

create or replace function public.join_draft(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.drafts;
begin
  select * into v_draft from public.drafts where invite_token = p_token for update;
  if v_draft.id is null then
    return jsonb_build_object('code', 'invalid', 'draft_id', null);
  end if;
  if v_draft.status <> 'lobby' then
    return jsonb_build_object('code', 'not_lobby', 'draft_id', v_draft.id);
  end if;
  if v_draft.captain_a = auth.uid() then
    return jsonb_build_object('code', 'is_creator', 'draft_id', v_draft.id);
  end if;
  if v_draft.captain_b is not null then
    if v_draft.captain_b = auth.uid() then
      return jsonb_build_object('code', 'already_joined', 'draft_id', v_draft.id);
    end if;
    return jsonb_build_object('code', 'full', 'draft_id', v_draft.id);
  end if;

  update public.drafts set captain_b = auth.uid() where id = v_draft.id;
  return jsonb_build_object('code', 'joined', 'draft_id', v_draft.id);
end;
$$;
