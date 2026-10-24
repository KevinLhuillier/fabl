-- Pronunciation of a single word or expression (ElevenLabs MP3 in the public "audio" bucket),
-- played from the translation sheet and the vocabulary cards. Keyed by the spelled form, not
-- the lemma: "took" has its own clip, and "record" (noun and verb) shares one.
-- `text` is normalized: lowercase, straight apostrophes. Filled by `npm run generate-word-audio`
-- from content/pronunciations.json.
create table public.pronunciations (
  text       text primary key,
  audio_url  text not null,
  created_at timestamptz not null default now()
);

alter table public.pronunciations enable row level security;

create policy "Content is public" on public.pronunciations
  for select to anon, authenticated using (true);
