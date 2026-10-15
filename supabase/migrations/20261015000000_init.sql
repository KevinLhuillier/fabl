-- =============================================================================
-- Fabl — initial schema
--
-- Content (stories, passages, tokens, lemmas, translations):
--   public read, written only by the publish script (service_role bypasses RLS).
-- User data (progress, vocabulary, stats, xp events):
--   private, each user only sees and writes their own rows.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Types & helpers
-- -----------------------------------------------------------------------------

create type public.cefr_level as enum ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

create type public.xp_source as enum ('passage', 'story', 'review');

-- Keeps `updated_at` current on every UPDATE.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- CONTENT
-- =============================================================================

create table public.stories (
  id            uuid primary key default gen_random_uuid(),
  -- Stable identifier derived from the .ink file name: makes publishing idempotent.
  slug          text not null unique,
  title         text not null,
  level         public.cefr_level not null,
  summary       text not null default '',
  -- Compiled story (inkjs JSON), executed by the app.
  ink_json      jsonb not null,
  -- Number of passages, used for the in-story progress bar.
  passage_count integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index stories_level_idx on public.stories (level);

create trigger stories_updated_at
  before update on public.stories
  for each row execute function public.set_updated_at();

-- One passage = one Ink knot.
create table public.passages (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid not null references public.stories (id) on delete cascade,
  knot_name  text not null,
  -- Order of the knot in the source file (display / debugging only).
  position   integer not null,
  text       text not null,
  updated_at timestamptz not null default now(),
  unique (story_id, knot_name)
);

create trigger passages_updated_at
  before update on public.passages
  for each row execute function public.set_updated_at();

-- Dictionary entry: a base form + its part of speech ("walk"/NOUN ≠ "walk"/VERB).
create table public.lemmas (
  id         bigint generated always as identity primary key,
  word       text not null,
  -- Universal POS tag from spaCy (NOUN, VERB, ADJ, ...).
  pos        text not null,
  created_at timestamptz not null default now(),
  unique (word, pos)
);

-- A passage split into tokens. Concatenating `text || whitespace` in `position`
-- order rebuilds the passage exactly. Punctuation has no lemma.
create table public.tokens (
  passage_id uuid not null references public.passages (id) on delete cascade,
  position   integer not null,
  text       text not null,
  -- Whitespace following the token ('' or ' ' most of the time).
  whitespace text not null default '',
  lemma_id   bigint references public.lemmas (id) on delete set null,
  primary key (passage_id, position)
);

create index tokens_lemma_idx on public.tokens (lemma_id);

create table public.translations (
  id          bigint generated always as identity primary key,
  lemma_id    bigint not null references public.lemmas (id) on delete cascade,
  -- ISO 639-1 language code ('fr' for now).
  lang        text not null check (lang ~ '^[a-z]{2}$'),
  translation text not null,
  example     text,
  updated_at  timestamptz not null default now(),
  unique (lemma_id, lang)
);

create trigger translations_updated_at
  before update on public.translations
  for each row execute function public.set_updated_at();

-- =============================================================================
-- USER DATA
-- =============================================================================

create table public.user_progress (
  user_id          uuid not null references auth.users (id) on delete cascade,
  story_id         uuid not null references public.stories (id) on delete cascade,
  -- Serialized inkjs state (story.state.toJson()).
  ink_state        jsonb,
  -- Distinct passages seen in the current run, for the progress bar.
  passages_visited integer not null default 0,
  completed        boolean not null default false,
  completed_at     timestamptz,
  updated_at       timestamptz not null default now(),
  primary key (user_id, story_id)
);

create trigger user_progress_updated_at
  before update on public.user_progress
  for each row execute function public.set_updated_at();

-- Words the user looked up. PK (user_id, lemma_id) = no duplicates.
create table public.user_vocabulary (
  user_id          uuid not null references auth.users (id) on delete cascade,
  lemma_id         bigint not null references public.lemmas (id) on delete cascade,
  -- Sentence where the word was first met, and the story it came from.
  context_sentence text,
  story_id         uuid references public.stories (id) on delete set null,
  added_at         timestamptz not null default now(),
  -- Spaced repetition (simplified SM-2).
  interval_days    integer not null default 0 check (interval_days >= 0),
  ease             real not null default 2.5 check (ease >= 1.3),
  repetitions      integer not null default 0 check (repetitions >= 0),
  due_at           timestamptz not null default now(),
  last_reviewed_at timestamptz,
  primary key (user_id, lemma_id)
);

create index user_vocabulary_due_idx on public.user_vocabulary (user_id, due_at);

create table public.user_stats (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  total_xp         integer not null default 0 check (total_xp >= 0),
  current_streak   integer not null default 0 check (current_streak >= 0),
  best_streak      integer not null default 0 check (best_streak >= 0),
  -- User's *local* calendar day of last activity (streaks follow the user's day).
  last_active_date date,
  daily_goal_xp    integer not null default 30 check (daily_goal_xp > 0),
  updated_at       timestamptz not null default now()
);

create trigger user_stats_updated_at
  before update on public.user_stats
  for each row execute function public.set_updated_at();

-- XP history. `local_date` = user's local day, used for the daily goal.
create table public.xp_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  source     public.xp_source not null,
  amount     integer not null check (amount > 0 and amount <= 1000),
  local_date date not null,
  created_at timestamptz not null default now()
);

create index xp_events_user_date_idx on public.xp_events (user_id, local_date);

-- Create the stats row as soon as an account is created.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_stats (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.stories         enable row level security;
alter table public.passages        enable row level security;
alter table public.lemmas          enable row level security;
alter table public.tokens          enable row level security;
alter table public.translations    enable row level security;
alter table public.user_progress   enable row level security;
alter table public.user_vocabulary enable row level security;
alter table public.user_stats      enable row level security;
alter table public.xp_events       enable row level security;

-- Content: read-only for everyone. No write policy → only service_role can write.
create policy "Content is public" on public.stories      for select to anon, authenticated using (true);
create policy "Content is public" on public.passages     for select to anon, authenticated using (true);
create policy "Content is public" on public.lemmas       for select to anon, authenticated using (true);
create policy "Content is public" on public.tokens       for select to anon, authenticated using (true);
create policy "Content is public" on public.translations for select to anon, authenticated using (true);

-- User data: owner only. `(select auth.uid())` is evaluated once per query (faster than per row).
create policy "Own progress" on public.user_progress
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Own vocabulary" on public.user_vocabulary
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Read own stats" on public.user_stats
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Insert own stats" on public.user_stats
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Update own stats" on public.user_stats
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- XP history is append-only for the user.
create policy "Read own xp events" on public.xp_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Insert own xp events" on public.xp_events
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Explicit grants (RLS still applies on top of them).
grant select on public.stories, public.passages, public.lemmas, public.tokens, public.translations
  to anon, authenticated;
grant select, insert, update, delete on public.user_progress, public.user_vocabulary
  to authenticated;
grant select, insert, update on public.user_stats to authenticated;
grant select, insert on public.xp_events to authenticated;
