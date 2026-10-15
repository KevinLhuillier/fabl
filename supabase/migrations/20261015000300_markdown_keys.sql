-- Stories are now written in Markdown (Ink is no longer used): the Ink-specific
-- column name "knot_name" becomes "key".
--   chapters.key  "chapter_<n>" (or an explicit id from the story file)
--   passages.key  "<chapter key>.page_<n>"
-- Unique constraints (story_id, key) follow the renamed columns.
alter table public.chapters rename column knot_name to key;
alter table public.passages rename column knot_name to key;
