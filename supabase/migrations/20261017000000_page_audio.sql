-- Voice-over of a page: MP3 URL, set from the story file's "@audio <url>" line.
-- Null: the page has no recording (the app hides the player).
alter table public.passages add column audio_url text;

-- Public bucket for the voice-overs, uploaded from the admin app (service role).
-- Public: the app streams them by URL, no policy needed for reading.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audio', 'audio', true, 20971520, array['audio/mpeg'])
on conflict (id) do nothing;
