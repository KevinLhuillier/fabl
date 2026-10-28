-- Premium stories: the first two chapters are free (was the first one only).
-- Keep in sync with FREE_CHAPTERS (apps/mobile/src/lib/premium.tsx).

drop policy "Free pages, or premium" on public.passages;
create policy "Free pages, or premium" on public.passages
  for select to anon, authenticated
  using (
    (select public.is_premium())
    or exists (
      select 1
      from public.chapters c
      join public.stories s on s.id = c.story_id
      where c.id = passages.chapter_id
        and (not s.premium or c.position < 2)
    )
  );
