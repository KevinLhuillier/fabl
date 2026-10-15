-- =============================================================================
-- Linear stories split into chapters (no more choices).
--
-- Ink stays the authoring format, but the app no longer runs inkjs: it reads a
-- story's chapters and pages (passages) in order. Reading progress becomes
-- "chapter + page" instead of a serialized ink state.
-- =============================================================================

-- Content is republished by the script in the new format; reading progress
-- stored in the old format (ink state) can't be converted.
delete from public.passages;
truncate public.user_progress;

alter type public.xp_source add value if not exists 'chapter';

-- -----------------------------------------------------------------------------
-- Chapters
-- -----------------------------------------------------------------------------

create table public.chapters (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid not null references public.stories (id) on delete cascade,
  -- Ink knot of the chapter: stable key for idempotent publishing.
  knot_name  text not null,
  position   integer not null,
  title      text not null,
  page_count integer not null default 0,
  word_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (story_id, knot_name)
);

create index chapters_story_idx on public.chapters (story_id, position);

create trigger chapters_updated_at
  before update on public.chapters
  for each row execute function public.set_updated_at();

-- A passage is now a page of a chapter; `knot_name` holds "knot.stitch".
alter table public.passages
  add column chapter_id uuid not null references public.chapters (id) on delete cascade,
  add column page_index integer not null,
  drop column steps_to_end;

create index passages_chapter_idx on public.passages (chapter_id, page_index);

alter table public.stories
  drop column ink_json,
  add column chapter_count integer not null default 0,
  add column word_count integer not null default 0;

-- -----------------------------------------------------------------------------
-- Reading progress
-- -----------------------------------------------------------------------------

-- Story level: only "completed" remains (chapters carry the details).
alter table public.user_progress
  drop column ink_state,
  drop column passages_visited;

create table public.user_chapter_progress (
  user_id      uuid not null references auth.users (id) on delete cascade,
  chapter_id   uuid not null references public.chapters (id) on delete cascade,
  -- Page the reader is on (0-based); reset to 0 when the chapter is finished.
  page_index   integer not null default 0 check (page_index >= 0),
  completed    boolean not null default false,
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (user_id, chapter_id)
);

create trigger user_chapter_progress_updated_at
  before update on public.user_chapter_progress
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.chapters              enable row level security;
alter table public.user_chapter_progress enable row level security;

create policy "Content is public" on public.chapters
  for select to anon, authenticated using (true);

create policy "Own chapter progress" on public.user_chapter_progress
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select on public.chapters to anon, authenticated;
grant select, insert, update, delete on public.user_chapter_progress to authenticated;
