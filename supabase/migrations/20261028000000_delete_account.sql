-- Account deletion from the app (required by Google Play): the signed-in user deletes
-- their own auth user. Every user table references auth.users with "on delete cascade",
-- so progress, vocabulary, stats, XP and activity go with it.
create function public.delete_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
