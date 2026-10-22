-- Daily goal in minutes of practice (reading + vocabulary review) instead of XP.
-- The XP system is removed: its history (xp_events) and totals are dropped.

-- Practice time per user and local day (the user's calendar day, like streaks).
create table public.daily_activity (
  user_id    uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  seconds    integer not null default 0 check (seconds >= 0),
  primary key (user_id, local_date)
);

alter table public.daily_activity enable row level security;

create policy "Own activity" on public.daily_activity
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.daily_activity to authenticated;

alter table public.user_stats
  add column daily_goal_minutes integer not null default 10 check (daily_goal_minutes > 0),
  add column total_seconds integer not null default 0 check (total_seconds >= 0);

-- Adds practice time to a day and to the total in one call; returns the day's
-- seconds. Runs as the caller: RLS limits it to their own rows. The app sends
-- time in small chunks, hence the bound per call.
create function public.record_activity(p_local_date date, p_seconds integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  day_seconds integer;
begin
  if p_seconds < 1 or p_seconds > 600 then
    raise exception 'record_activity: seconds must be between 1 and 600';
  end if;

  insert into public.daily_activity (user_id, local_date, seconds)
  values ((select auth.uid()), p_local_date, p_seconds)
  on conflict (user_id, local_date)
  do update set seconds = public.daily_activity.seconds + excluded.seconds
  returning seconds into day_seconds;

  update public.user_stats
  set total_seconds = total_seconds + p_seconds
  where user_id = (select auth.uid());

  return day_seconds;
end;
$$;

revoke execute on function public.record_activity(date, integer) from public, anon;
grant execute on function public.record_activity(date, integer) to authenticated;

-- XP removal.
drop table public.xp_events;
drop type public.xp_source;
alter table public.user_stats drop column total_xp, drop column daily_goal_xp;
