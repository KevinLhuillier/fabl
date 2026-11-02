-- Free accounts, new rules:
-- - no word limit any more: the list keeps every word;
-- - one review session a day (20 words at most, set by the app);
-- - no free chapter in a premium story: one premium chapter a day can be unlocked, all
--   stories together. An unlocked chapter stays readable for good.
-- The day is the user's local day, sent by the app (like record_activity), allowed one
-- day around the server's date (time zones run from UTC−12 to UTC+14).
-- Keep in sync with apps/mobile/src/lib/premium.tsx.

-- -----------------------------------------------------------------------------
-- Words: no limit
-- -----------------------------------------------------------------------------

drop trigger user_vocabulary_limit on public.user_vocabulary;
drop function public.check_vocabulary_limit();

-- Raises `invalid_local_date` when the day is not today somewhere on Earth.
create function public.check_local_date(p_local_date date)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_local_date is null
    or p_local_date < (now() at time zone 'utc')::date - 1
    or p_local_date > (now() at time zone 'utc')::date + 1 then
    raise exception 'invalid_local_date' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.check_local_date(date) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Premium chapters: one a day
-- -----------------------------------------------------------------------------

create table public.chapter_unlocks (
  user_id    uuid not null references auth.users (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  -- Local day of the unlock; null for the chapters read before this rule (kept open).
  local_date date,
  created_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);

-- One unlock a day (nulls are distinct: the chapters carried over don't count).
create unique index chapter_unlocks_one_a_day on public.chapter_unlocks (user_id, local_date);

alter table public.chapter_unlocks enable row level security;

-- No write policy: unlock_chapter() writes.
create policy "Own unlocks" on public.chapter_unlocks
  for select to authenticated using (user_id = (select auth.uid()));

-- anon too: the passages policy reads this table (no policy for anon, so no row).
grant select on public.chapter_unlocks to anon, authenticated;

-- Premium chapters already started stay open (they were free until now).
insert into public.chapter_unlocks (user_id, chapter_id)
select p.user_id, p.chapter_id
from public.user_chapter_progress p
join public.chapters c on c.id = p.chapter_id
join public.stories s on s.id = c.story_id
where s.premium
on conflict do nothing;

drop policy "Free pages, or premium" on public.passages;
create policy "Free pages, unlocked, or premium" on public.passages
  for select to anon, authenticated
  using (
    (select public.is_premium())
    or exists (
      select 1
      from public.chapters c
      join public.stories s on s.id = c.story_id
      where c.id = passages.chapter_id
        and not s.premium
    )
    or exists (
      select 1
      from public.chapter_unlocks u
      where u.chapter_id = passages.chapter_id
        and u.user_id = (select auth.uid())
    )
  );

-- Opens a chapter for the signed-in user. Returns true when it is readable (free story,
-- premium account, already unlocked, or unlocked now); raises `chapter_limit` when another
-- chapter was already unlocked that day.
create function public.unlock_chapter(p_chapter_id uuid, p_local_date date)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_premium_story boolean;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = 'P0001';
  end if;
  select s.premium into v_premium_story
  from public.chapters c
  join public.stories s on s.id = c.story_id
  where c.id = p_chapter_id;
  if v_premium_story is null then
    raise exception 'chapter_not_found' using errcode = 'P0001';
  end if;
  if not v_premium_story or public.has_premium(v_user) or exists (
    select 1 from public.chapter_unlocks u
    where u.user_id = v_user and u.chapter_id = p_chapter_id
  ) then
    return true;
  end if;

  perform public.check_local_date(p_local_date);
  if exists (
    select 1 from public.chapter_unlocks u
    where u.user_id = v_user and u.local_date = p_local_date
  ) then
    raise exception 'chapter_limit' using errcode = 'P0001';
  end if;
  insert into public.chapter_unlocks (user_id, chapter_id, local_date)
  values (v_user, p_chapter_id, p_local_date);
  return true;
exception
  -- Another chapter unlocked the same day at the same moment (two devices).
  when unique_violation then
    raise exception 'chapter_limit' using errcode = 'P0001';
end;
$$;

revoke execute on function public.unlock_chapter(uuid, date) from public, anon;
grant execute on function public.unlock_chapter(uuid, date) to authenticated;

-- -----------------------------------------------------------------------------
-- Review: one session a day
-- -----------------------------------------------------------------------------

create table public.review_sessions (
  user_id    uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

alter table public.review_sessions enable row level security;

-- No write policy: start_review_session() writes.
create policy "Own review sessions" on public.review_sessions
  for select to authenticated using (user_id = (select auth.uid()));

grant select on public.review_sessions to authenticated;

-- Records today's session (at its first answer). Raises `review_limit` for a free account
-- that already had one that day; premium accounts review as often as they like.
create function public.start_review_session(p_local_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = 'P0001';
  end if;
  perform public.check_local_date(p_local_date);
  insert into public.review_sessions (user_id, local_date)
  values (v_user, p_local_date)
  on conflict do nothing;
  if not found and not public.has_premium(v_user) then
    raise exception 'review_limit' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.start_review_session(date) from public, anon;
grant execute on function public.start_review_session(date) to authenticated;
