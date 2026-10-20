-- Profile setting: language of the interface and of the word translations.
-- Null: follow the device language.
alter table public.user_stats add column lang text check (lang in ('fr', 'es'));
