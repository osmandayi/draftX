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
