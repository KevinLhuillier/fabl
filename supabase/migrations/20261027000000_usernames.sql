-- Username: chosen at sign-up, unique across the app regardless of case
-- ("Leo" and "leo" are the same name). 3 to 20 letters, digits or underscores.
-- Null: account created before usernames (the app asks for one at the next launch).
alter table public.user_stats
  add column username text check (username ~ '^[A-Za-z0-9_]{3,20}$');

create unique index user_stats_username_key on public.user_stats (lower(username));

-- Sign-up screen: tells whether a name is free before creating the account
-- (signed-out users cannot read user_stats).
create function public.username_available(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.user_stats where lower(username) = lower(trim(p_name))
  );
$$;

grant execute on function public.username_available(text) to anon, authenticated;

-- The username travels in the sign-up metadata (options.data.username).
-- A name taken in the meantime makes the sign-up fail: the app shows "already taken".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_stats (user_id, username)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'username'), ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;
