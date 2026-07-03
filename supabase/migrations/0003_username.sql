-- =============================================================================
-- Username-based accounts. Sign-up asks for a username + password; the app
-- stores the username here and registers a synthetic email with Supabase Auth.
-- A real email can be linked later via auth.updateUser (profile page).
-- =============================================================================

alter table public.profiles
  add column if not exists username text unique
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');

-- Populate username from sign-up metadata (null for Google/OAuth users), and
-- fall back to it for the display name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := new.raw_user_meta_data ->> 'username';

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    v_username,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      v_username,
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
