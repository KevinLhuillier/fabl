-- Premium subscription (Google Play through RevenueCat).
--
-- The server decides who is premium: RevenueCat calls the `revenuecat-webhook` Edge Function
-- on every change, the function reads the customer back from RevenueCat and writes this table
-- with the service_role key. The app only reads it.
--
-- Free accounts:
-- - read every chapter of a free story, and only the first chapter of a premium story;
-- - keep 30 words at most in their list.

-- -----------------------------------------------------------------------------
-- Subscriptions
-- -----------------------------------------------------------------------------

create table public.subscriptions (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  -- RevenueCat entitlement giving premium.
  entitlement  text not null default 'premium',
  -- The customer has (or had) the entitlement; false when they never bought it.
  active       boolean not null default false,
  -- End of the paid period, grace period included; null = never expires (lifetime).
  expires_at   timestamptz,
  product_id   text,
  -- RevenueCat store name: play_store, app_store…
  store        text,
  -- False once the user cancelled: still premium until expires_at.
  will_renew   boolean,
  billing_issue boolean not null default false,
  -- Test purchase (Play licence tester).
  sandbox      boolean not null default false,
  updated_at   timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- No write policy: only the Edge Functions (service_role) write.
create policy "Own subscription" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

-- Premium right now. Not callable from the API for another user (see is_premium()).
create function public.has_premium(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = p_user_id
      and s.active
      and (s.expires_at is null or s.expires_at > now())
  );
$$;

revoke execute on function public.has_premium(uuid) from public, anon, authenticated;

-- The signed-in user is premium (false when signed out).
create function public.is_premium()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and public.has_premium(auth.uid());
$$;

grant execute on function public.is_premium() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Premium stories: only the first chapter is free
-- -----------------------------------------------------------------------------

alter table public.stories add column premium boolean not null default false;

-- Stories and chapters stay public (shelf, summary, table of contents); the text is not.
-- `(select …)` evaluates is_premium() once per query instead of once per row.
drop policy "Content is public" on public.passages;
create policy "Free pages, or premium" on public.passages
  for select to anon, authenticated
  using (
    (select public.is_premium())
    or exists (
      select 1
      from public.chapters c
      join public.stories s on s.id = c.story_id
      where c.id = passages.chapter_id
        and (not s.premium or c.position = 0)
    )
  );

-- A token is readable with its page (the subquery goes through the passages policy).
drop policy "Content is public" on public.tokens;
create policy "Tokens of readable pages" on public.tokens
  for select to anon, authenticated
  using (exists (select 1 from public.passages p where p.id = tokens.passage_id));

-- -----------------------------------------------------------------------------
-- Free accounts: 30 words at most
-- -----------------------------------------------------------------------------

-- Raises `vocabulary_limit` (the app shows the premium offer). Adding a word already in the
-- list stays allowed: the app's upsert ignores it. Words added before the limit are kept.
create function public.check_vocabulary_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.user_vocabulary v
    where v.user_id = new.user_id and v.lemma_id = new.lemma_id
  ) or public.has_premium(new.user_id) then
    return new;
  end if;
  -- Keep in sync with FREE_WORD_LIMIT (apps/mobile/src/lib/premium.tsx).
  if (select count(*) from public.user_vocabulary v where v.user_id = new.user_id) >= 30 then
    raise exception 'vocabulary_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger user_vocabulary_limit
  before insert on public.user_vocabulary
  for each row execute function public.check_vocabulary_limit();
