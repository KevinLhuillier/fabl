-- Front cover of a story (image URL, set from the story file's "cover:" field).
-- Null: the app draws a default cover in the story's level color.
alter table public.stories add column cover_url text;
